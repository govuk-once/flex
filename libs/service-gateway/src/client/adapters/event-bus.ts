import type { ApiResult } from "@flex/flex-fetch";
import type { EventBusDownstream, EventBusRequest } from "@types";

// eslint-disable-next-line @typescript-eslint/require-await
export async function createEventBusClient(
  name: string,
  _: EventBusDownstream,
) {
  return {
    config: undefined,
    request: (_: EventBusRequest): Promise<ApiResult<unknown>> => {
      throw new Error(`"${name}" event-bus client not yet implemented`);
    },
  };
}
