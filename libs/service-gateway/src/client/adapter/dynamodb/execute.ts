import { logger } from "@flex/logging";
import type { ApiResult } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";

import { DynamoDBOperationError, toError, toGatewayError } from "./errors";

const SERVICE = "dynamodb";

export type OperationName =
  | "Scan"
  | "Query"
  | "GetItem"
  | "PutItem"
  | "UpdateItem"
  | "DeleteItem";

export interface ExecuteOptions<Data> {
  readonly operation: OperationName;
  readonly send: () => Promise<Data>;
  readonly count?: (data: Data) => number;
}

export type Execute = <Data>(
  options: ExecuteOptions<Data>,
) => Promise<ApiResult<Data>>;

export function createExecute(table: string): Execute {
  return async ({ operation, send, count }) => {
    emitTelemetry(TelemetryEvent.third_party_request_sent, {
      service: SERVICE,
      table,
      operation,
    });

    try {
      const data = await send();

      emitTelemetry(TelemetryEvent.third_party_response_received, {
        service: SERVICE,
        table,
        operation,
        ...(count && { count: count(data) }),
      });

      return { ok: true, status: 200, data };
    } catch (error) {
      if (error instanceof DynamoDBOperationError) {
        const { name, reason, event, status, message, body } = error;

        logger.error("DynamoDB operation failed", {
          table,
          operation,
          name,
          reason,
        });

        emitTelemetry(event, { service: SERVICE, table, operation });

        return {
          ok: false,
          error: { status, message, ...(body !== undefined && { body }) },
        };
      }

      const parsedError = toError(error);

      logger.error("DynamoDB operation failed", {
        table,
        operation,
        name: parsedError.name,
        reason: parsedError.message,
      });

      emitTelemetry(TelemetryEvent.third_party_request_error, {
        service: SERVICE,
        table,
        operation,
        name: parsedError.name,
      });

      return { ok: false, error: toGatewayError(parsedError) };
    }
  };
}
