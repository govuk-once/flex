import { sigv4FetchWithCredentials } from "@flex/utils";
import { z } from "zod";

import type {
  RemoteConsentResponse,
  UdpRemoteContract,
} from "./contracts/remote";
import { RemoteConsentResponseSchema } from "./contracts/remote";

export interface UdpRemoteClientConfig {
  region: string;
  apiUrl: string;
  apiKey: string;
  consumerRoleArn: string;
  externalId?: string;
}

/** Derives path prefix (stage) from apiUrl for building remote paths.
 *  Returns path without leading/trailing slashes to avoid producing paths
 *  starting with // which URL constructor interprets as host (e.g. //dev -> host=dev). */
function getPathPrefix(apiUrl: string): string {
  const pathname = new URL(apiUrl).pathname;
  return pathname.replace(/^\/|\/$/g, "").trim() || "";
}

export type ApiError = {
  status: number;
  message: string;
  code?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

const REMOTE_SCHEMA_MISMATCH = "REMOTE_SCHEMA_MISMATCH" as const;

async function fetchRemote(
  config: UdpRemoteClientConfig,
  options: {
    method: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  return sigv4FetchWithCredentials({
    region: config.region,
    baseUrl: config.apiUrl,
    roleArn: config.consumerRoleArn,
    externalId: config.externalId,
    method: options.method,
    path: options.path,
    body: options.body,
    headers: options.headers,
  });
}

async function validateResponse<T>(
  response: Response,
  schema?: z.ZodType<T>,
): Promise<ApiResult<T>> {
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    return {
      ok: false,
      status: 422,
      error: {
        status: 422,
        message: "Invalid JSON response",
        code: REMOTE_SCHEMA_MISMATCH,
      },
    };
  }

  if (!response.ok) {
    const errBody =
      json != null && typeof json === "object"
        ? (json as { message?: string; code?: string })
        : null;
    return {
      ok: false,
      status: response.status,
      error: {
        status: response.status,
        message: errBody?.message ?? "Request failed",
        code: errBody?.code,
      },
    };
  }

  if (schema) {
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        status: 422,
        error: {
          status: 422,
          message: "Remote API contract violation",
          code: REMOTE_SCHEMA_MISMATCH,
        },
      };
    }
    return { ok: true, status: response.status, data: parsed.data };
  }
  return { ok: true, status: response.status, data: json as T };
}

/**
 * Remote client for the UDP API.
 *
 * Typed methods per UdpRemoteContract. Validates responses with Zod schemas.
 * Private to the gateway package — domain services NEVER import from here.
 */
export function createUdpRemoteClient(config: UdpRemoteClientConfig) {
  const prefix = getPathPrefix(config.apiUrl);
  const path = (suffix: string) => {
    const p = suffix.replace(/^\//, "");
    return prefix ? `/${prefix}/${p}` : `/${p}`;
  };

  return {
    getNotifications: (
      requestingServiceUserId: string,
    ): Promise<ApiResult<RemoteConsentResponse>> =>
      fetchRemote(config, {
        method: "GET",
        path: path("v1/notifications"),
        headers: {
          "x-api-key": config.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      }).then((res) => validateResponse(res, RemoteConsentResponseSchema)),

    postNotifications: (
      body: UdpRemoteContract["postNotifications"]["body"],
      requestingServiceUserId: string,
    ): Promise<ApiResult<unknown>> =>
      fetchRemote(config, {
        method: "POST",
        path: path("v1/notifications"),
        body,
        headers: {
          "x-api-key": config.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      }).then((res) => validateResponse(res)),

    postUser: (
      body: UdpRemoteContract["postUser"]["body"],
    ): Promise<ApiResult<unknown>> =>
      fetchRemote(config, {
        method: "POST",
        path: path("v1/user"),
        body,
        headers: {
          "x-api-key": config.apiKey,
        },
      }).then((res) => validateResponse(res)),

    /** Generic call for untyped routes (e.g. identity). Returns raw Response. */
    call: (options: {
      method: string;
      path: string;
      body?: unknown;
      headers?: Record<string, string>;
    }) => fetchRemote(config, {
      ...options,
      headers: {
        ...options.headers,
        "x-api-key": config.apiKey,
      },
    }),
  };
}

export type UdpRemoteClient = ReturnType<typeof createUdpRemoteClient>;
