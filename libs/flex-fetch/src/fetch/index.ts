import { getLogger } from "@flex/logging";
import { NumberUpTo } from "@flex/utils";
import { backOff } from "exponential-backoff";

const MAX_ATTEMPTS = 6;
const MIN_DELAY_MS = 10;
const MAX_DELAY_MS = 1000;

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface FlexFetchRequestInit extends RequestInit {
  retryAttempts?: NumberUpTo<typeof MAX_ATTEMPTS>;
  maxRetryDelay?: number;
  /** Custom fetch implementation (e.g. aws-sigv4 signed fetcher). When provided, used instead of global fetch. */
  fetcher?: Fetcher;
}

/**
 * A fetch wrapper that adds retry logic with exponential backoff and abort capability.
 * @param url
 * @returns An object containing the fetch request promise and an abort function.
 */
export function flexFetch(url: string | Request | URL): {
  request: Promise<Response>;
  abort: () => void;
};

/**
 * A fetch wrapper that adds retry logic with exponential backoff and abort capability.
 * @param url
 * @param options a FlexFetchRequestInit object with retryAttempts and maxRetryDelay options
 * @returns An object containing the fetch request promise and an abort function.
 */
export function flexFetch(
  url: string | Request | URL,
  options: FlexFetchRequestInit,
): { request: Promise<Response>; abort: () => void };

export function flexFetch(
  url: string | Request | URL,
  options?: FlexFetchRequestInit,
): { request: Promise<Response>; abort: () => void } {
  const logger = getLogger();
  logger.info("flex-fetch called", { url });
  logger.debug("flex-fetch options", { options });

  const { retryAttempts, maxRetryDelay, fetcher, ...fetchOptions } =
    options ?? {};
  const doFetch = fetcher ?? fetch;

  const controller = new AbortController();

  const retryDelayNormalised = Math.max(
    MIN_DELAY_MS,
    Math.min(MAX_DELAY_MS, maxRetryDelay ?? MIN_DELAY_MS),
  );

  const retryAttemptsNormalised = Math.min(retryAttempts ?? 1, MAX_ATTEMPTS);
  const retry = !!retryAttempts;

  const backOffWrapper = retry ? backOff : <T>(fn: () => Promise<T>) => fn();

  return {
    request: backOffWrapper(
      () => {
        return doFetch(url, { ...fetchOptions, signal: controller.signal });
      },
      {
        numOfAttempts: retryAttemptsNormalised,
        maxDelay: retryDelayNormalised,
        jitter: "full",
        retry(error, attemptNumber) {
          logger.warn("flex-fetch retrying request", {
            url,
            error,
            attemptNumber,
          });
          logger.debug("options", fetchOptions);
          return !controller.signal.aborted;
        },
      },
    ).catch((error: unknown) => {
      const requestUrl = url instanceof Request ? url.url : url.toString();
      logger.error("flex-fetch failed", {
        url: requestUrl,
        error,
      });
      logger.debug("options", fetchOptions);
      throw error;
    }),
    abort: () => {
      controller.abort();
    },
  };
}
