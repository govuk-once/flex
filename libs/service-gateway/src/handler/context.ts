import type { Logger } from "@flex/logging";
import type { ReadonlyRecord } from "@flex/utils";

import type { GatewayClientMap, GatewayContext } from "../types";
import type { ParsedRequest } from "../utils/request";

interface ContextOptions {
  readonly clients: GatewayClientMap;
  readonly resources: ReadonlyRecord<string, unknown>;
  readonly logger: Logger;
}

export function buildContext(
  request: ParsedRequest,
  { clients, resources, logger }: ContextOptions,
): GatewayContext {
  return { clients, resources, logger, ...request };
}
