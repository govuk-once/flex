import z from "zod";

const jwksSchema = z.object({
  keys: z.array(
    z.object({
      kty: z.string(),
      kid: z.string(),
      use: z.string(),
      n: z.string(),
      e: z.string(),
      alg: z.string(),
    }).catchall(z.string()),
  ),
});

export type Jwks = z.infer<typeof jwksSchema>;

export function parseJwks(jwksData: unknown): Jwks {
  const parsed = jwksSchema.safeParse(jwksData);

  if (!parsed.success) {
    throw new Error(`Invalid JWKS data: ${z.treeifyError(parsed.error)}`);
  }

  return parsed.data;
}

/**
 * Constructs the issuer URL for a given AWS region and Cognito User Pool ID.
 *
 * @param region
 * @param userPoolId
 * @returns
 */
export function getIssuer(region: string, userPoolId: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}

/**
 * Calls the dummy JWKS endpoint using the global fetch API.
 *
 * In production, the runtime (Node.js 18+) provides fetch via the global
 * scope. For tests, we stub globalThis.fetch.
 */
export async function getCognitoJwks(
  userPoolId: string,
  region: string,
): Promise<Jwks> {
  if (!globalThis.fetch) {
    throw new Error("Global fetch API is not available in this runtime");
  }

  const response = await fetch(
    `${getIssuer(region, userPoolId)}/.well-known/jwks.json`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch JWKS from Cognito JWKS endpoint: ${response.status} ${response.statusText}`,
    );
  }

  const jwksData = await response.json();
  const jwks = parseJwks(jwksData);

  return jwks;
}
