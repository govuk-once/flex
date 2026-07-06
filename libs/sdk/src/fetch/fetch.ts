import { logger } from "@flex/logging";
import { NumberUpTo } from "@flex/utils";
import { backOff } from "exponential-backoff";

import { buildHeaders } from "./headers";

const MAX_ATTEMPTS = 6;
const MIN_DELAY_MS = 10;
const MAX_DELAY_MS = 1000;

export interface FlexFetchRequestInit extends RequestInit {
  retryAttempts?: NumberUpTo<typeof MAX_ATTEMPTS>;
  maxRetryDelay?: number;
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
 * @param fetcher custom fetch implementation (e.g. signed fetch)
 * @returns An object containing the fetch request promise and an abort function.
 */
export function flexFetch(
  url: string | Request | URL,
  options: FlexFetchRequestInit,
  fetcher?: typeof fetch,
): { request: Promise<Response>; abort: () => void };

export function flexFetch(
  url: string | Request | URL,
  options?: FlexFetchRequestInit,
  fetcher: typeof fetch = fetch,
): { request: Promise<Response>; abort: () => void } {
  logger.debug("flex-fetch called", { url });
  logger.debug("flex-fetch options", { options });

  const {
    retryAttempts,
    maxRetryDelay,
    headers: inputHeaders,
    signal: callerSignal,
    ...fetchOptions
  } = options ?? {};

  const headers = buildHeaders(url, inputHeaders);

  const controller = new AbortController();
  const signal = callerSignal
    ? AbortSignal.any([controller.signal, callerSignal])
    : controller.signal;

  const retryDelayNormalised = Math.max(
    MIN_DELAY_MS,
    Math.min(MAX_DELAY_MS, maxRetryDelay ?? MAX_DELAY_MS),
  );

  const totalAttempts = Math.min((retryAttempts ?? 0) + 1, MAX_ATTEMPTS);

  return {
    request: backOff(
      () => {
        return fetcher(url, { ...fetchOptions, headers, signal });
      },
      {
        numOfAttempts: totalAttempts,
        maxDelay: retryDelayNormalised,
        jitter: "full",
        retry(error, attemptNumber) {
          if (signal.aborted) return false;
          if (attemptNumber >= totalAttempts) return false;

          logger.warn("flex-fetch retrying request", {
            url,
            error,
            attemptNumber,
          });
          return true;
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
