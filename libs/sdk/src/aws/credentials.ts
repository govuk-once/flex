import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { logger } from "@flex/logging";
import { memoize } from "@smithy/property-provider";
import type { AwsCredentialIdentityProvider } from "@smithy/types";

export interface AssumedRoleCredentialsOptions {
  roleArn: string;
  roleName: string;
  region?: string;
  externalId?: string;
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

/**
 * Resolves a memoized credential provider for a cross-account role.
 *
 * Use this anywhere an AWS client needs to act as a role in another account
 * (e.g. an AWS SDK client's `credentials` option, or a SigV4 signed fetcher).
 * The route must declare a `"role"` resource so the Lambda is granted
 * `sts:AssumeRole` on the target role ARN.
 */
export function getAssumedRoleCredentials({
  roleArn,
  roleName,
  region,
  externalId,
}: AssumedRoleCredentialsOptions): AwsCredentialIdentityProvider {
  const cacheKey = getCredentialsCacheKey(roleArn, externalId);

  const cached = cachedCredentialProviders.get(cacheKey);
  if (cached) return cached;

  const provider = fromTemporaryCredentials({
    clientConfig: {
      region,
    },
    params: {
      RoleArn: roleArn,
      RoleSessionName: roleName,
      ...(externalId && { ExternalId: externalId }),
    },
  });

  const loggingProvider = async () => {
    const creds = await provider();
    logger.info("STS credentials refreshed", {
      expiration: creds.expiration?.toISOString(),
    });
    return creds;
  };

  // isExpired: refresh when less than 5 minutes remain, giving a buffer before the 1h STS TTL.
  // requiresRefresh: return true whenever the credential has an expiry — prevents memoize from
  // marking it as a permanent constant and skipping the isExpired check on subsequent calls.
  const credentials = memoize(
    loggingProvider,
    (creds) =>
      creds.expiration !== undefined &&
      creds.expiration.getTime() - Date.now() < 300_000,
    (creds) => creds.expiration !== undefined,
  );

  cachedCredentialProviders.set(cacheKey, credentials);

  return credentials;
}
