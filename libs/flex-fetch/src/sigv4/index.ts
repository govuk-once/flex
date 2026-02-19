import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";
import { createSignedFetcher } from "aws-sigv4-fetch";

import { flexFetch, type FlexFetchRequestInit } from "../fetch";

export interface Sigv4FetcherOptions {
  region?: string;
  baseUrl: string;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
  fetchOptions?: FlexFetchRequestInit;
}

export function createSigv4Fetcher(options: Sigv4FetcherOptions) {
  const { baseUrl, region, credentials, fetchOptions } = options;

  const signedFetch = createSignedFetcher({
    region,
    credentials,
    service: "execute-api",
  });

  return function (path: string) {
    return flexFetch(`${baseUrl}${path}`, fetchOptions ?? {}, signedFetch);
  };
}

/**
 * Unbounded cache of credential providers. Within a lambda execution context,
 * the rotation of credentials is unlikely to grow too large to cause runtime issues.
 */
const cachedCredentialProviders: Map<string, AwsCredentialIdentityProvider> =
  new Map();

/**
 * Get a cache key for a credential provider.
 * externalId is optional but undefined is valid and should be included in the cache key.
 * Assuming a role with a different externalId represents a different trust relationship.
 */
function getCredentialsCacheKey(roleArn: string, externalId?: string) {
  return `${roleArn}:${externalId ?? ""}`;
}

export function createSigv4FetchWithCredentials(
  options: Sigv4FetcherOptions & {
    roleArn: string;
    roleName: string;
    externalId?: string;
  },
) {
  const cacheKey = getCredentialsCacheKey(options.roleArn, options.externalId);

  let credentials = cachedCredentialProviders.get(cacheKey);
  if (!credentials) {
    credentials = fromTemporaryCredentials({
      params: {
        RoleArn: options.roleArn,
        RoleSessionName: options.roleName,
        ...(options.externalId && { ExternalId: options.externalId }),
      },
    });
    cachedCredentialProviders.set(cacheKey, credentials);
  }

  return createSigv4Fetcher({
    ...options,
    credentials,
  });
}
