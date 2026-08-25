import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
  QueryCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { logger } from "@flex/logging";
import { getAssumedRoleCredentials } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import { assertNever } from "@flex/utils";
import { z } from "zod";

import type {
  DynamoClient,
  DynamoQueryOptions,
  DynamoScanOptions,
} from "../../types";

export type DynamoAuth =
  | { type: "default" }
  | {
      type: "assume-role";
      region: string;
      roleArn: string;
      roleName: string;
      externalId?: string;
    };

export interface DynamoClientOptions {
  readonly tableName: string;
  readonly region: string;
  readonly auth: DynamoAuth;
}

function buildDocumentClient({
  auth,
  region,
}: Pick<DynamoClientOptions, "auth" | "region">): DynamoDBDocumentClient {
  switch (auth.type) {
    case "default":
      return DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    case "assume-role": {
      const { roleArn, roleName, externalId } = auth;

      return DynamoDBDocumentClient.from(
        new DynamoDBClient({
          region,
          credentials: getAssumedRoleCredentials({
            region: auth.region,
            roleArn,
            roleName,
            externalId,
          }),
        }),
      );
    }
    default:
      return assertNever(auth);
  }
}

type PaginateOptions = {
  readonly operation: "Scan" | "Query";
  readonly errorMessage: string;
  readonly schema?: z.ZodType;
  readonly buildCommand: (
    startKey: Record<string, unknown> | undefined,
  ) => ScanCommandInput | QueryCommandInput;
};

/**
 * Runs a paginated DynamoDB operation to completion, handling telemetry,
 * error logging, and optional schema validation. `scan` and `query` each
 * supply only the parts that differ: the operation name and the command input.
 */
async function paginate(
  client: DynamoDBDocumentClient,
  tableName: string,
  { operation, errorMessage, schema, buildCommand }: PaginateOptions,
) {
  emitTelemetry(TelemetryEvent.third_party_request_sent, {
    service: "dynamodb",
    operation,
    tableName,
  });

  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;

  try {
    do {
      const command =
        operation === "Scan"
          ? new ScanCommand(buildCommand(startKey))
          : new QueryCommand(buildCommand(startKey));

      const result = await client.send(command);

      items.push(...(result.Items ?? []));
      startKey = result.LastEvaluatedKey;
    } while (startKey);
  } catch (error) {
    const { name, message } = error as Error;

    // The gateway maps 5xx to a flat "upstream service unavailable" and only
    // logs the cause at debug, which the handler's INFO level drops. Without
    // this, an AccessDenied on AssumeRole and a missing table are the same
    // opaque 502 in a deployed environment.
    //
    // `reason`, not `message`: powertools reserves `message` for the log's own
    // text and silently drops the key, which is what hid the AWS detail here.
    logger.error(errorMessage, { tableName, name, reason: message });

    emitTelemetry(TelemetryEvent.third_party_request_error, {
      service: "dynamodb",
      tableName,
    });

    return { ok: false as const, error: { status: 502, message } };
  }

  emitTelemetry(TelemetryEvent.third_party_response_received, {
    service: "dynamodb",
    tableName,
    count: items.length,
  });

  if (!schema) {
    return { ok: true as const, status: 200, data: items };
  }

  const parsed = z.array(schema).safeParse(items);

  if (!parsed.success) {
    logger.error("DynamoDB row failed schema validation", {
      tableName,
      issues: z.prettifyError(parsed.error),
    });

    emitTelemetry(TelemetryEvent.response_validation_failed, {
      service: "dynamodb",
      tableName,
    });

    // 502 rather than typedFetch's 422: a table entry we cannot parse is an
    // upstream data fault, and the gateway passes 4xx straight through to
    // the caller, who did nothing wrong.
    return {
      ok: false as const,
      error: {
        status: 502,
        message: "Response validation failed",
        body: z.treeifyError(parsed.error),
      },
    };
  }

  return { ok: true as const, status: 200, data: parsed.data };
}

export function createDynamoClient({
  auth,
  region,
  tableName,
}: DynamoClientOptions): DynamoClient {
  const client = buildDocumentClient({ auth, region });

  const scan = ({ attribute, value, schema }: DynamoScanOptions) =>
    paginate(client, tableName, {
      operation: "Scan",
      errorMessage: "DynamoDB scan failed",
      schema,
      buildCommand: (startKey) => ({
        TableName: tableName,
        FilterExpression: "#attribute = :value",
        ExpressionAttributeNames: { "#attribute": attribute },
        ExpressionAttributeValues: { ":value": value },
        ExclusiveStartKey: startKey,
      }),
    });

  const query = ({
    indexName,
    partitionKey,
    partitionValue,
    scanIndexForward,
    schema,
  }: DynamoQueryOptions) =>
    paginate(client, tableName, {
      operation: "Query",
      errorMessage: "DynamoDB query failed",
      schema,
      buildCommand: (startKey) => ({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: "#pk = :pkValue",
        ExpressionAttributeNames: { "#pk": partitionKey },
        ExpressionAttributeValues: { ":pkValue": partitionValue },
        ScanIndexForward: scanIndexForward,
        ExclusiveStartKey: startKey,
      }),
    });

  return { scan, query } as DynamoClient;
}
