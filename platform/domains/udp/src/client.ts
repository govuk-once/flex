import { createSigv4FetchWithCredentials } from "@flex/flex-fetch";
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

/**
 * Returns the path suffix to append to baseUrl.
 * baseUrl already contains the stage (e.g. /gateways/udp); we only append the API path (e.g. v1/notifications).
 */
function pathSuffix(suffix: string): string {
  return suffix.replace(/^\//, "");
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
  const fetchFn = createSigv4FetchWithCredentials({
    ...config,
    ...options,
    baseUrl: config.apiUrl,
    roleArn: config.consumerRoleArn,
  });

  return fetchFn(options);
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
  return {
    getNotifications: (
      requestingServiceUserId: string,
    ): Promise<ApiResult<RemoteConsentResponse>> =>
      fetchRemote(config, {
        method: "GET",
        path: pathSuffix("v1/notifications"),
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
        path: pathSuffix("v1/notifications"),
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
        path: pathSuffix("v1/user"),
        body,
        headers: {
          "x-api-key": config.apiKey,
        },
      }).then((res) => validateResponse(res)),

    /** Generic call for arbitrary method/path/headers. Path is relative to baseUrl (e.g. "v1/notifications"). */
    call: (options: {
      method: string;
      path: string;
      body?: unknown;
      headers?: Record<string, string>;
    }): Promise<ApiResult<unknown>> =>
      fetchRemote(config, {
        ...options,
        path: pathSuffix(options.path),
      }).then((res) => validateResponse(res)),
  };
}

export type UdpRemoteClient = ReturnType<typeof createUdpRemoteClient>;
