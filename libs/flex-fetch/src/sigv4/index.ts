import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";
import { createSignedFetcher } from "aws-sigv4-fetch";

import { flexFetch, type FlexFetchRequestInit } from "../fetch";

interface Sigv4FetcherOptions {
  region?: string;
  baseUrl: string | URL;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
  fetchOptions?: FlexFetchRequestInit;
}

export function createSigv4Fetcher(options: Sigv4FetcherOptions) {
  const signedFetch = createSignedFetcher({
    ...options,
    service: "execute-api",
  });

  return flexFetch(options.baseUrl, options.fetchOptions ?? {}, signedFetch);
}

const cachedCredentialProviders: Map<string, AwsCredentialIdentityProvider> =
  new Map();

function getCredentialsCacheKey(roleArn: string, externalId?: string) {
  return `${roleArn}:${externalId ?? ""}`;
}

export function createSigv4FetchWithCredentials(
  options: Sigv4FetcherOptions & {
    roleArn: string;
    externalId?: string;
    roleName?: string;
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
