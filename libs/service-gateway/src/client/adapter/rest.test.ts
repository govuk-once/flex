import type { ApiResult } from "@flex/sdk";
import { typedFetch } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import type { HttpMethod } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { RestClient, RestWriteOperationOptions } from "../../types";
import { buildFetcher } from "../fetcher/build";
import type { RestAuth } from "./rest";
import { createRestClient } from "./rest";

vi.mock("@flex/sdk", () => ({ typedFetch: vi.fn() }));

vi.mock("@flex/telemetry");

vi.mock("../fetcher/build");

const baseUrl = "https://api.example.com";
const mockPublicAuth: RestAuth = { type: "public" };
const mockSigv4Auth: RestAuth = {
  type: "sigv4",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/example",
  roleName: "test-session",
  externalId: "test-external-id",
};
const mockApiResult: ApiResult<unknown> = { ok: true, status: 200, data: {} };

const buildMockFetcher = () => {
  const request = Promise.resolve(new Response());
  const fetcher = vi.fn(() => ({ request, abort: vi.fn() }));

  vi.mocked(buildFetcher).mockReturnValue(fetcher);
  vi.mocked(typedFetch).mockResolvedValue(mockApiResult);

  return { fetcher, request };
};

describe("createRestClient", () => {
  it.for([
    { auth: mockPublicAuth, type: "public" },
    { auth: mockSigv4Auth, type: "sigv4" },
  ])("builds the fetcher using $type client options", ({ auth }) => {
    buildMockFetcher();

    createRestClient({ auth, baseUrl });

    expect(buildFetcher).toHaveBeenCalledExactlyOnceWith({ auth, baseUrl });
  });

  it.for<{
    method: HttpMethod;
    call: (client: RestClient) => Promise<unknown>;
  }>([
    { method: "GET", call: (client) => client.get("/v1/example") },
    { method: "DELETE", call: (client) => client.delete("/v1/example") },
  ])("sends a $method request", async ({ method, call }) => {
    const { fetcher } = buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await call(client);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/v1/example", {
      method,
      headers: { Accept: "application/json" },
      body: undefined,
      thirdParty: true,
    });
  });

  it.for<{
    method: HttpMethod;
    call: (
      client: RestClient,
      body: RestWriteOperationOptions["body"],
    ) => Promise<unknown>;
  }>([
    {
      method: "POST",
      call: (client, body) => client.post("/v1/example", { body }),
    },
    {
      method: "PUT",
      call: (client, body) => client.put("/v1/example", { body }),
    },
    {
      method: "PATCH",
      call: (client, body) => client.patch("/v1/example", { body }),
    },
  ])("sends a $method request with a body", async ({ method, call }) => {
    const { fetcher } = buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await call(client, { key: "value" });

    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/v1/example", {
      method,
      headers: { Accept: "application/json" },
      body: JSON.stringify({ key: "value" }),
      thirdParty: true,
    });
  });

  it("appends the query string to the path", async () => {
    const query = { key: "value" };
    const [expectedQueryString] = extractQueryParams(query);

    const { fetcher } = buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await client.get("/v1/example", { query });

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `/v1/example?${expectedQueryString}`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("omits the query string when the query parameters are empty", async () => {
    const { fetcher } = buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await client.get("/v1/example", { query: {} });

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      "/v1/example",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("merges base with request headers where request headers win on conflicts", async () => {
    const { fetcher } = buildMockFetcher();

    const client = createRestClient({
      baseUrl,
      auth: mockPublicAuth,
      headers: {
        "Content-Type": "application/json",
        "x-base": "value",
        "x-conflict": "base-value",
      },
    });

    await client.post("/v1/example", {
      headers: { "x-request": "value", "x-conflict": "request-value" },
    });

    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/v1/example", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-base": "value",
        "x-request": "value",
        "x-conflict": "request-value",
      },
      body: undefined,
      thirdParty: true,
    });
  });

  it("passes the schema through to typed fetch when it has been provided", async () => {
    const { request } = buildMockFetcher();

    const schema = z.object({ key: z.string() });

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await client.get("/v1/example", { schema });

    expect(typedFetch).toHaveBeenCalledExactlyOnceWith(request, schema);
  });

  it("emits third party telemetry around the request", async () => {
    buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    await client.get("/v1/example");

    expect(emitTelemetry).toHaveBeenCalledWith(
      TelemetryEvent.third_party_request_sent,
      { method: "GET", baseUrl, path: "/v1/example" },
    );
    expect(emitTelemetry).toHaveBeenCalledWith(
      TelemetryEvent.third_party_response_received,
      { baseUrl, path: "/v1/example", status: 200 },
    );
  });

  it("returns the API response", async () => {
    const { request } = buildMockFetcher();

    const client = createRestClient({ baseUrl, auth: mockPublicAuth });

    const result = await client.get("/v1/example");

    expect(typedFetch).toHaveBeenCalledExactlyOnceWith(request, undefined);
    expect(result).toStrictEqual(mockApiResult);
  });
});
