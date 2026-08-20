import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";
import { createSignedFetcher } from "aws-sigv4-fetch";

import type { AssumedRoleCredentialsOptions } from "../aws/credentials";
import { getAssumedRoleCredentials } from "../aws/credentials";
import { flexFetch, type FlexFetchRequestInit } from "./fetch";

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

export interface CreateSigv4FetchWithCredentialsOptions
  extends Sigv4FetcherOptions, AssumedRoleCredentialsOptions {}

export function createSigv4FetchWithCredentials(
  options: CreateSigv4FetchWithCredentialsOptions,
) {
  const credentials = getAssumedRoleCredentials(options);

  return createSigv4Fetcher({
    ...options,
    credentials,
  });
}
