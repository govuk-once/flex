import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { importJWK, JWK, SignJWT } from "jose";
import z from "zod";

import { BaseTokenGenerator } from "./TokenGenerator";

class StubTokenGenerator implements BaseTokenGenerator {
  private privateKey: CryptoKey;
  public publicJWKS: { keys: JWK[] };
  public kid: string;

  constructor(privateKey: CryptoKey, publicJWKS: { keys: JWK[] }, kid: string) {
    this.privateKey = privateKey;
    this.publicJWKS = publicJWKS;
    this.kid = kid;
  }

  async getToken(): Promise<string> {
    const sub = "d6a2b234-e011-7084-f347-912225bd2861";

    const builder = new SignJWT({
      sub,
      "cognito:groups": ["eu-west-2_testUserPoolId_onelogin"],
      iss: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      version: 2,
      client_id: "testClientId",
      token_use: "access",
      scope: "openid email",
      username: `onelogin_${sub}`,
    })
      .setProtectedHeader({ alg: "RS256", kid: this.kid, typ: "JWT" })
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime("1h");

    return await builder.sign(this.privateKey);
  }
}

export async function getStubTokenGenerator(): Promise<StubTokenGenerator> {
  const rawSecret = await getSecret(
    "/development/flex-secret/auth/e2e/private_jwk",
    { transform: "json" },
  );

  const PrivateKeySchema = z.object({
    alg: z.string(),
    d: z.string(),
    dp: z.string(),
    dq: z.string(),
    e: z.string(),
    kty: z.string(),
    n: z.string(),
    p: z.string(),
    q: z.string(),
    qi: z.string(),
    use: z.string(),
    kid: z.string(),
  });

  const privateKeyData = PrivateKeySchema.parse(rawSecret);

  const privateKey = (await importJWK(privateKeyData, "RS256")) as CryptoKey;
  const publicJWKS = {
    keys: [
      {
        alg: "RS256",
        e: "AQAB",
        kty: "RSA",
        n: privateKeyData.n,
        use: "sig",
        kid: privateKeyData.kid,
      },
    ],
  };

  return new StubTokenGenerator(privateKey, publicJWKS, privateKeyData.kid);
}
