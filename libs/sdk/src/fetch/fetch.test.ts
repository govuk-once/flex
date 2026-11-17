import { logger } from "@flex/logging";
import { it } from "@flex/testing";
import * as backOff from "exponential-backoff";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { flexFetch } from "./fetch";

vi.mock("@flex/logging");

describe("flex-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Delayed replies from aborted requests otherwise leak into the next test
    nock.abortPendingRequests();
  });

  const EXAMPLE_BASE_URL = "https://example.com";
  const EXAMPLE_PATH = "/data";

  it("makes a single fetch request without retries when no retryAttempts provided", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");

    const okResponse = { hello: "world" };
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().reply(200, okResponse);

    const { request } = flexFetch("https://example.com/data");
    const res = await request;
    const resBody = (await res.json()) as typeof okResponse;

    expect(resBody).toStrictEqual(okResponse);
    expect(nock.isDone()).toBe(true);

    expect(backoffSpy).toHaveBeenCalledOnce();
  });

  it("uses backOff when retryAttempts is provided and eventually succeeds", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");

    const err = new Error("network");

    const okResponse = { hello: "world" };
    nock(EXAMPLE_BASE_URL)
      .get(EXAMPLE_PATH)
      .twice()
      .replyWithError(err)
      .get(EXAMPLE_PATH)
      .once()
      .reply(200, okResponse);

    const { request } = flexFetch("https://example.com/data", {
      retryAttempts: 3,
      maxRetryDelay: 500,
    });

    const res = await request;
    const resBody = (await res.json()) as typeof okResponse;
    expect(resBody).toStrictEqual(okResponse);

    expect(nock.isDone()).toBe(true);

    expect(backoffSpy).toHaveBeenCalledTimes(1);
    expect(backoffSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 4,
        maxDelay: 500,
        jitter: "full",
      }),
    );
  });

  it("clamps maxRetryDelay between 10 and 1000", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).times(4).replyWithError(err);

    const { request: request1 } = flexFetch("https://example.com/data", {
      retryAttempts: 1,
      maxRetryDelay: 5,
    });
    await expect(request1).rejects.toThrow();

    expect(backoffSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxDelay: 10,
      }),
    );

    const { request: request2 } = flexFetch("https://example.com/data", {
      retryAttempts: 1,
      maxRetryDelay: 5000,
    });
    await expect(request2).rejects.toThrow();

    expect(backoffSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxDelay: 1000,
      }),
    );
  });

  it("aborts an in-flight request and rejects with AbortError", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");

    vi.unstubAllGlobals();

    const err = new Error("network");
    nock(EXAMPLE_BASE_URL)
      .get(EXAMPLE_PATH)
      .once()
      .delay(1000)
      .replyWithError(err);
    const { request, abort } = flexFetch("https://example.com/data");

    setTimeout(abort, 100);

    await expect(request).rejects.toThrow("This operation was aborted");
    expect(nock.isDone()).toBe(true);
    expect(backoffSpy).toHaveBeenCalledOnce();
  });

  it("stops retries when aborted during retry", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");

    // Injected fetcher rather than nock so timing is deterministic: the first
    // attempt fails, later attempts stay in flight until the signal aborts
    const err = new Error("network");
    const fetcher = vi.fn<typeof fetch>((_url, init) => {
      if (fetcher.mock.calls.length === 1) return Promise.reject(err);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted", "AbortError"));
        });
      });
    });

    const { request, abort } = flexFetch(
      "https://example.com/data",
      { retryAttempts: 5, maxRetryDelay: 100 },
      fetcher,
    );

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
    abort();

    await expect(request).rejects.toThrow("This operation was aborted");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(backoffSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        retry: expect.any(Function),
      }),
    );
  });

  it("caps retryAttempts at MAX_ATTEMPTS (5)", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");

    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).times(6).replyWithError(err);

    const { request } = flexFetch("https://example.com/data", {
      retryAttempts: 10 as never,
      maxRetryDelay: 100,
    });

    await expect(request).rejects.toThrow();
    expect(backoffSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 6,
      }),
    );
  });

  it("logs errors on failure using logger.error", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).twice().replyWithError(err);

    const { request } = flexFetch(new URL("https://example.com/data"), {
      retryAttempts: 1,
    });

    // fetch wraps network errors in TypeError("fetch failed", { cause })
    const fetchFailed = expect.objectContaining({
      name: "TypeError",
      cause: err,
    }) as unknown;
    await expect(request).rejects.toThrow("fetch failed");
    await expect(request).rejects.toEqual(fetchFailed);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("flex-fetch failed", {
      url: "https://example.com/data",
      error: fetchFailed,
    });
    expect(logger.debug).toHaveBeenCalledWith("options", expect.any(Object));
  });

  it("correctly logs the request URL when a Request object is provided", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).times(4).replyWithError(err);

    const { request } = flexFetch(new Request("https://example.com/data"), {
      retryAttempts: 3,
      maxRetryDelay: 500,
    });

    await expect(request).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "flex-fetch failed",
      expect.objectContaining({
        url: "https://example.com/data",
      }),
    );
  });

  it("correctly logs options on error", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).times(4).replyWithError(err);

    const { request } = flexFetch(new Request("https://example.com/data"), {
      retryAttempts: 3,
      maxRetryDelay: 500,
      mode: "cors",
    });

    await expect(request).rejects.toThrow();

    expect(logger.debug).toHaveBeenCalledWith(
      "options",
      expect.objectContaining({
        mode: "cors",
      }),
    );
  });
});
