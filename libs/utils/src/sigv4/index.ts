import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/identity";
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
  headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
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
    },
    body: bodyString,
  });

  return response;
}

export interface Sigv4CredentialsOptions {
  roleArn: string;
  externalId?: string;
}

export function sigv4FetchWithCredentials(
  options: Options & Sigv4CredentialsOptions,
) {
  const credentials = fromTemporaryCredentials({
    params: {
      RoleArn: options.roleArn,
      RoleSessionName: "consumer-session",
      ...(options.externalId && { ExternalId: options.externalId }),
    },
  });
  return sigv4Fetch({
    ...options,
    credentials,
  });
}
