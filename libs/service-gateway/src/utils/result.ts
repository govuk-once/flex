import type { ApiResult } from "@flex/flex-fetch";

export function mapApiResult<In, Out>(
  result: ApiResult<In>,
  transform: (data: In) => Out,
): ApiResult<Out> {
  return result.ok ? { ...result, data: transform(result.data) } : result;
}
