import type {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
} from "@smithy/types";

interface Sigv4ConnectionParams {
  region: string;
  baseUrl: string;
  host?: string;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}

export function createSigv4Fetcher() {}
