import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { NumberUpTo } from "@flex/utils";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";
import { createSignedFetcher } from "aws-sigv4-fetch";

import { flexFetch, type FlexFetchRetryOptions } from "../fetch/index";

interface Sigv4ConnectionParams {
  region: string;
  baseUrl: string;
  host?: string;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}

interface Sigv4RequestParams {
  method: string;
  path: string;
  body?: unknown;
}

interface Sigv4Headers {
  headers?: Record<string, string>;
}

type Sigv4FetchOptions = Sigv4ConnectionParams &
  Sigv4RequestParams &
  Sigv4Headers &
  FlexFetchRetryOptions;

export async function sigv4Fetch({
  region,
  baseUrl,
  method,
  path,
  body,
  host,
  credentials,
  headers,
  retryAttempts = 3,
  maxRetryDelay,
}: Sigv4FetchOptions) {
  const base = new URL(baseUrl);
  const basePath = base.pathname.endsWith("/")
    ? base.pathname
    : `${base.pathname}/`;
  const pathSeg = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(basePath + pathSeg, base.origin);

  const bodyString = body ? JSON.stringify(body) : undefined;

  const signedFetch = createSignedFetcher({
    service: "execute-api",
    region,
    credentials,
  });

  const { request } = flexFetch(url, {
    fetcher: signedFetch,
    retryAttempts:
      retryAttempts > 0
        ? (Math.min(retryAttempts, 5) as NumberUpTo<typeof retryAttempts>)
        : undefined,
    maxRetryDelay,
    method,
    headers: {
      ...headers,
      Host: host ?? url.host,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: bodyString,
  });

  return request;
}

export interface Sigv4CredentialsOptions {
  roleArn: string;
  externalId?: string;
}

const cachedCredentialProviders: Map<string, AwsCredentialIdentityProvider> =
  new Map();

function getCredentialsCacheKey(roleArn: string, externalId?: string): string {
  return `${roleArn}:${externalId ?? ""}`;
}

export function createSigv4FetchWithCredentials(
  options: Sigv4FetchOptions & Sigv4CredentialsOptions,
) {
  const cacheKey = getCredentialsCacheKey(options.roleArn, options.externalId);

  let credentials = cachedCredentialProviders.get(cacheKey);
  if (!credentials) {
    credentials = fromTemporaryCredentials({
      params: {
        RoleArn: options.roleArn,
        RoleSessionName: "consumer-session",
        ...(options.externalId && { ExternalId: options.externalId }),
      },
    });
    cachedCredentialProviders.set(cacheKey, credentials);
  }

  return createSigv4Fetch({
    ...options,
    credentials,
  });
}

interface Sigv4BaseConfig
  extends Sigv4ConnectionParams, Sigv4Headers, FlexFetchRetryOptions {}

interface Sigv4RequestOptions
  extends Sigv4RequestParams, Sigv4Headers, FlexFetchRetryOptions {}

export function createSigv4Fetch(baseConfig: Sigv4BaseConfig) {
  return async (request: Sigv4RequestOptions) => {
    return sigv4Fetch({
      ...baseConfig,
      ...request,
      headers: { ...baseConfig.headers, ...request.headers },
    });
  };
}
