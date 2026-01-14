/**
 * Calls the dummy JWKS endpoint using the global fetch API.
 *
 * In production, the runtime (Node.js 18+) provides fetch via the global
 * scope. For tests, we stub globalThis.fetch.
 */
export async function callCognitoJwksEndpoint(
  userPoolId: string,
  region: string,
): Promise<unknown> {
  if (!globalThis.fetch) {
    throw new Error("Global fetch API is not available in this runtime");
  }

  const response = await fetch(
    `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch JWKS from dummy endpoint: ${response.status} ${response.statusText}`,
    );
  }

  return await response.json();
}
