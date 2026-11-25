export type { AssumedRoleCredentialsOptions } from "./aws/credentials";
export { getAssumedRoleCredentials } from "./aws/credentials";
export * from "./config";
export {
  CORRELATION_ID_HEADER,
  extractCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from "./correlation";
export { domain } from "./domain";
export type {
  ApiResult,
  FlexFetchRequestInit,
  Sigv4FetcherOptions,
} from "./fetch";
export {
  createSigv4Fetcher,
  createSigv4FetchWithCredentials,
  flexFetch,
  typedFetch,
} from "./fetch";
export * from "./route";
export type * from "./types";
export { clearTmp } from "./utils/cleanup";
export { isDomainDeployed, isRouteDeployed } from "./utils/is-deployed";
