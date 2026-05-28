import type { QueryParams } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import type {
  ReplyBody as NockReplyBody,
  RequestBodyMatcher as NockRequestBodyMatcher,
} from "nock";
import nock from "nock";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const PRIVATE_GATEWAY_BASE_URL =
  "https://execute-api.eu-west-2.amazonaws.com";

const httpMethodMap: Record<HttpMethod, Lowercase<HttpMethod>> = {
  GET: "get",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
  DELETE: "delete",
};

interface RequestOptions {
  headers?: Record<string, string>;
  query?: QueryParams;
  body?: unknown;
}

interface Interceptor {
  reply: (status: number, body?: unknown) => Interceptor;
}

interface Api {
  get: (path: string, options?: RequestOptions) => Interceptor;
  post: (path: string, options?: RequestOptions) => Interceptor;
  put: (path: string, options?: RequestOptions) => Interceptor;
  patch: (path: string, options?: RequestOptions) => Interceptor;
  delete: (path: string, options?: RequestOptions) => Interceptor;
}

function buildApi(baseUrl: string, prefix = ""): Api {
  const scope = nock(baseUrl);

  const request =
    (method: HttpMethod) =>
    (
      path: string,
      { body: requestBody, headers, query }: RequestOptions = {},
    ): Interceptor => {
      const reply = (status: number, body?: unknown): Interceptor => {
        const interceptor = scope[httpMethodMap[method]](
          `${prefix}${path}`,
          requestBody as NockRequestBodyMatcher,
        );

        if (query && Object.keys(query).length > 0) {
          interceptor.query(extractQueryParams(query)[1]);
        }

        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
            interceptor.matchHeader(name, value);
          }
        }

        interceptor.reply(status, body as NockReplyBody);

        return { reply };
      };

      return { reply };
    };

  return {
    get: request("GET"),
    post: request("POST"),
    put: request("PUT"),
    patch: request("PATCH"),
    delete: request("DELETE"),
  };
}

export interface HttpFixture {
  gateway: (target: string, version?: string) => Api;
  domain: (target: string, version?: string) => Api;
  url: (baseUrl: string) => Api;
}

interface CreateHttpOptions {
  baseUrl?: string;
}

export function createHttp({
  baseUrl = PRIVATE_GATEWAY_BASE_URL,
}: CreateHttpOptions = {}): HttpFixture & Disposable {
  return {
    gateway: (target, version = "v1") =>
      buildApi(baseUrl, `/gateways/${target}/${version}`),
    domain: (target, version = "v1") =>
      buildApi(baseUrl, `/domains/${target}/${version}`),
    url: (fullPath) => buildApi(fullPath),
    [Symbol.dispose]() {
      const pending = nock.pendingMocks();

      nock.cleanAll();

      if (pending.length > 0) {
        throw new Error(
          `Failed to intercept HTTP requests:\n${pending.join("\n")}`,
        );
      }
    },
  };
}

export const network = {
  disable: () => {
    nock.disableNetConnect();
  },
  enable: () => {
    nock.enableNetConnect();
  },
};
