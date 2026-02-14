import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";
import { createSignedFetcher } from "aws-sigv4-fetch";

interface Options {
  region: string;
  baseUrl: string;
  method: string;
  path: string;
  body?: unknown;
  host?: string;
  headers?: Record<string, string>;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}

export async function sigv4Fetch({
  region,
  baseUrl,
  method,
  path,
  body,
  host,
  credentials,
  headers,
}: Options) {
  const url = new URL(path, baseUrl);
  const bodyString = body ? JSON.stringify(body) : undefined;

  const signedFetch = createSignedFetcher({
    service: "execute-api",
    region,
    credentials,
  });

  const response = await signedFetch(url, {
    method,
    headers: {
      ...headers,
      Host: host ?? url.host,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: bodyString,
  });

  return response;
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

export function sigv4FetchWithCredentials(
  options: Options & Sigv4CredentialsOptions,
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

  return sigv4Fetch({
    ...options,
    credentials,
  });
}

interface Sigv4BaseConfig {
  region: string;
  baseUrl: string;
  headers?: Record<string, string>;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
  host?: string;
}

interface Sigv4RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function createSigv4Fetch(baseConfig: Sigv4BaseConfig) {
  return async (request: Sigv4RequestOptions) => {
    return sigv4Fetch({
      ...baseConfig,
      ...request,
      headers: { ...baseConfig.headers, ...request.headers },
    });
  };
}

export async function sigv4FetchTyped<T>(
  options: Options,
  responseSchema: z.ZodType<T>,
): Promise<{ data: T; response: Response }> {
  const response = await sigv4Fetch(options);
  const raw = await response.json();
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new createHttpError.BadGateway(
      `Invalid response from ${options.path}: ${parsed.error.message}`,
    );
  }
  return { data: parsed.data, response };
}
