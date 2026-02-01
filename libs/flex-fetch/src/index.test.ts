import { getLogger } from "@flex/logging";
import { it } from "@flex/testing";
import { backOff, IBackOffOptions } from "exponential-backoff";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { flexFetch } from "./index";

vi.mock("@flex/logging", () => {
  const loggerFunctions = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return {
    getLogger: () => loggerFunctions,
  };
});

vi.mock("exponential-backoff", () => {
  const backOff = vi.fn(
    async <T>(fn: () => Promise<T>, options?: Partial<IBackOffOptions>) => {
      const maxAttempts = options?.numOfAttempts ?? 1;
      let lastError: unknown;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await fn();
        } catch (e) {
          lastError = e;
          const shouldRetry = options?.retry
            ? options.retry(e, i)
            : i < maxAttempts - 1;
          if (!shouldRetry) throw e;
        }
      }
      throw lastError;
    },
  );
  return { backOff };
});

function createAbortableFetchMock() {
  const fetchMock = vi.fn(
    (_: string | Request | URL, options?: { signal?: AbortSignal }) =>
      new Promise((_, reject) => {
        const signal = options?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new Error("AbortError: aborted"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new Error("AbortError: aborted"));
          });
        }
      }),
  );
  return fetchMock as typeof fetch;
}

function createSequentialFetchMock<T>(results: Array<() => Promise<T>>) {
  let previousResult: Promise<T> | null = null;
  const fetchMock = vi.fn(
    async (_input: string | Request | URL, _init?: never) => {
      const fn = results.shift();
      const result = fn?.() ?? previousResult;

      return (previousResult = result);
    },
  );
  return fetchMock as typeof fetch;
}

describe("flex-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes a single fetch request without retries when no retryAttempts provided", async () => {
    const okResponse = { ok: true, status: 200 } as unknown as Response;
    vi.stubGlobal(
      "fetch",
      createSequentialFetchMock([() => Promise.resolve(okResponse)]),
    );

    const { request } = flexFetch("https://example.com/data");
    const res = await request;
    expect(res).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    expect(backOff).not.toBeCalled();
  });

  it("uses backOff when retryAttempts is provided and eventually succeeds", async () => {
    const err = new Error("network");
    const okResponse = { ok: true, status: 200 } as unknown as Response;
    vi.stubGlobal(
      "fetch",
      createSequentialFetchMock([
        () => Promise.reject(err),
        () => Promise.reject(err),
        () => Promise.resolve(okResponse),
      ]),
    );
    const { request } = flexFetch("https://example.com/data", {
      retryAttempts: 3,
      maxRetryDelay: 500,
    });

    const res = await request;
    expect(res).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    expect(backOff).toBeCalledTimes(1);
    expect(backOff).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 3,
        maxDelay: 500,
        jitter: "full",
      }),
    );
  });

  it("clamps maxRetryDelay between 10 and 1000", async () => {
    const err = new Error("network");
    vi.stubGlobal(
      "fetch",
      createSequentialFetchMock([() => Promise.reject(err)]),
    );

    const { request: request1 } = flexFetch("https://example.com/data", {
      retryAttempts: 1,
      maxRetryDelay: 5,
    });
    await expect(request1).rejects.toThrow();

    expect(backOff).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxDelay: 10,
      }),
    );

    vi.clearAllMocks();
    globalThis.fetch = createSequentialFetchMock([() => Promise.reject(err)]);
    const { request: request2 } = flexFetch("https://example.com/data", {
      retryAttempts: 1,
      maxRetryDelay: 5000,
    });
    await expect(request2).rejects.toThrow();

    expect(backOff).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxDelay: 1000,
      }),
    );
  });

  it("aborts an in-flight request and rejects with AbortError", async () => {
    vi.stubGlobal("fetch", createAbortableFetchMock());
    const { request, abort } = flexFetch("https://example.com/slow");

    abort();
    await expect(request).rejects.toThrowError(
      new Error("AbortError: aborted"),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    expect(backOff).not.toBeCalled();
  });

  it("stops retries when aborted during retry", async () => {
    const err = new Error("network");

    globalThis.fetch = createSequentialFetchMock([() => Promise.reject(err)]);

    const { request, abort } = flexFetch("https://example.com/retry", {
      retryAttempts: 5,
      maxRetryDelay: 100,
    });

    abort();

    await expect(request).rejects.toThrowError(err);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    expect(backOff).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        retry: expect.any(Function),
      }),
    );
  });

  it("caps retryAttempts at MAX_ATTEMPTS (5)", async () => {
    const err = new Error("network");
    globalThis.fetch = createSequentialFetchMock([() => Promise.reject(err)]);

    const { request } = flexFetch("https://example.com/data", {
      retryAttempts: 10 as never,
      maxRetryDelay: 100,
    });
    await expect(request).rejects.toThrow();
    expect(backOff).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 6,
      }),
    );
  });

  it("logs errors on failure using getLogger.error", async () => {
    const err = new Error("boom");
    globalThis.fetch = createSequentialFetchMock([() => Promise.reject(err)]);

    const { request } = flexFetch(new URL("https://example.com/fail"), {
      retryAttempts: 1,
    });

    await expect(request).rejects.toThrow(err);
    const logger = getLogger();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledWith("flex-fetch failed", {
      url: "https://example.com/fail",
      options: {},
      error: err,
    });
  });

  it("correctly logs the request URL when a Request object is provided", async () => {
    const err = new Error("network");
    vi.stubGlobal(
      "fetch",
      createSequentialFetchMock([() => Promise.reject(err)]),
    );
    const { request } = flexFetch(new Request("https://example.com/data"), {
      retryAttempts: 3,
      maxRetryDelay: 500,
    });

    await expect(request).rejects.toThrow();
    const logger = getLogger();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledWith(
      "flex-fetch failed",
      expect.objectContaining({
        url: "https://example.com/data",
      }),
    );
  });
});
