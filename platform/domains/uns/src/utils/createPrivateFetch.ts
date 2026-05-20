import {
  createSigv4FetchWithCredentials,
  FlexFetchRequestInit,
} from "@flex/flex-fetch";
import { buildUrl, QueryParams } from "@flex/utils";

export interface PrivateFetchOptions extends FlexFetchRequestInit {
  query?: QueryParams;
}

export function createPrivateFetch(config: {
  baseUrl: string;
  roleArn: string;
}) {
  const fetcher = createSigv4FetchWithCredentials({
    baseUrl: config.baseUrl,
    roleArn: config.roleArn,
    roleName: "uns-consumer-session",
  });

  return (path: string, options?: PrivateFetchOptions) => {
    const { query, ...fetchOptions } = options ?? {};
    const url = buildUrl(config.baseUrl, path, query);
    return fetcher(`${url.pathname}${url.search}`, fetchOptions);
  };
}
