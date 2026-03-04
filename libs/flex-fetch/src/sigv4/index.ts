import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { memoize } from "@smithy/property-provider";
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
}

export function createSigv4Fetcher(options: Sigv4FetcherOptions) {
  const { baseUrl, region, credentials } = options;

  const signedFetch = createSignedFetcher({
    region,
    credentials,
    service: "execute-api",
  });

  return function (path: string, fetchOptions?: FlexFetchRequestInit) {
    return flexFetch(`${baseUrl}${path}`, fetchOptions ?? {}, signedFetch);
  };
}

/**
 * The SDK's `memoize` function caches internally to a specific provider instance.
 * If we don't store the *instance* of the provider in a module-level Map,
 * every Lambda invocation creates a brand-new provider with an empty internal
 * cache, forcing a fresh (and slow) STS AssumeRole call every time.
 * * This Map ensures we reuse the same provider instance across warm starts, allowing the SDK to actually utilize its 3600s credential TTL.
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

export interface CreateSigv4FetchWithCredentialsOptions extends Sigv4FetcherOptions {
  roleArn: string;
  roleName: string;
  externalId?: string;
}

export function createSigv4FetchWithCredentials(
  options: CreateSigv4FetchWithCredentialsOptions,
) {
  const cacheKey = getCredentialsCacheKey(options.roleArn, options.externalId);

  let credentials = cachedCredentialProviders.get(cacheKey);
  if (!credentials) {
    credentials = memoize(
      fromTemporaryCredentials({
        clientConfig: {
          region: options.region,
        },
        params: {
          RoleArn: options.roleArn,
          RoleSessionName: options.roleName,
          ...(options.externalId && { ExternalId: options.externalId }),
        },
      }),
    );

    cachedCredentialProviders.set(cacheKey, credentials);
  }

  return createSigv4Fetcher({
    ...options,
    credentials,
  });
}
