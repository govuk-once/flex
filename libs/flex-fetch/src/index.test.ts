import { getLogger } from "@flex/logging";
import { it } from "@flex/testing";
import * as backOff from "exponential-backoff";
import nock from "nock";
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

describe("flex-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("setTimeout", (fn: () => unknown) => fn());
    nock.cleanAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    expect(backoffSpy).not.toBeCalled();
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

    expect(backoffSpy).toBeCalledTimes(1);
    expect(backoffSpy).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 3,
        maxDelay: 500,
        jitter: "full",
      }),
    );
  });

  it("clamps maxRetryDelay between 10 and 1000", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

    const { request: request1 } = flexFetch("https://example.com/data", {
      retryAttempts: 1,
      maxRetryDelay: 5,
    });
    await expect(request1).rejects.toThrow();

    expect(backoffSpy).toBeCalledWith(
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

    expect(backoffSpy).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxDelay: 1000,
      }),
    );
  });

  it("aborts an in-flight request and rejects with AbortError", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");
    const fetchSpy = vi.spyOn(global, "fetch");

    vi.unstubAllGlobals();

    const { request, abort } = flexFetch("https://example.com/slow");

    abort();

    await expect(request).rejects.toThrowError("This operation was aborted");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(backoffSpy).not.toBeCalled();
  });

  it("stops retries when aborted during retry", async () => {
    const backoffSpy = vi.spyOn(backOff, "backOff");
    const fetchSpy = vi.spyOn(global, "fetch");

    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

    const { request, abort } = flexFetch("https://example.com/data", {
      retryAttempts: 5,
      maxRetryDelay: 100,
    });

    abort();

    await expect(request).rejects.toThrowError();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(backoffSpy).toBeCalledWith(
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
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

    const { request } = flexFetch("https://example.com/data", {
      retryAttempts: 10 as never,
      maxRetryDelay: 100,
    });

    await expect(request).rejects.toThrow();
    expect(backoffSpy).toBeCalledWith(
      expect.any(Function),
      expect.objectContaining({
        numOfAttempts: 6,
      }),
    );
  });

  it("logs errors on failure using getLogger.error", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

    const { request } = flexFetch(new URL("https://example.com/data"), {
      retryAttempts: 1,
    });

    await expect(request).rejects.toThrow(err);
    const logger = getLogger();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toBeCalledWith("flex-fetch failed", {
      url: "https://example.com/data",
      error: err,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.debug).toBeCalledWith("options", expect.any(Object));
  });

  it("correctly logs the request URL when a Request object is provided", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

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

  it("correctly logs options on error", async () => {
    const err = new Error("network");
    nock(EXAMPLE_BASE_URL).get(EXAMPLE_PATH).once().replyWithError(err);

    const { request } = flexFetch(new Request("https://example.com/data"), {
      retryAttempts: 3,
      maxRetryDelay: 500,
      mode: "cors",
    });

    await expect(request).rejects.toThrow();
    const logger = getLogger();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.debug).toBeCalledWith(
      "options",
      expect.objectContaining({
        mode: "cors",
      }),
    );
  });
});
