// libs/sdk-service-gw/src/types.ts
import { ApiResult } from "@flex/flex-fetch";
import { APIGatewayProxyEvent } from "aws-lambda";

export interface RouteContract<
  TClient,
  TInput = unknown,
  TRemoteResponse = unknown,
  TDomainResponse = unknown,
> {
  operation: string;

  // 1. Logic to extract data from the Lambda Event
  toRemote: (
    event: APIGatewayProxyEvent,
    params: Record<string, string>,
  ) => TInput | Promise<TInput>;

  // 2. Logic to call the specific client method
  // TInput is automatically shared with toRemote
  callRemote: (
    client: TClient,
    data: TInput,
  ) => Promise<ApiResult<TRemoteResponse>>;

  // 3. Optional logic to transform the remote response to your internal format
  toDomain?: (remote: TRemoteResponse) => TDomainResponse;
}
