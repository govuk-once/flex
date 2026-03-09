/**
 * Token generation logic mirroring:
 *   libs/testing/src/fixtures/StubTokenGenerator.ts
 *   libs/testing/src/fixtures/TokenGenerator.ts
 *   tests/e2e/src/setup.global.ts  (getJwtClient)
 *
 * Uses the AWS SDK directly instead of @aws-lambda-powertools/parameters.
 */

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { load } from "cheerio";
import { createServer } from "http";
import { importJWK, JWK, SignJWT } from "jose";
import pkceChallenge from "pkce-challenge";
import querystring from "querystring";
import { TOTP } from "totp-generator";
import { CookieJar } from "tough-cookie";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getSecret(secretId: string): Promise<unknown> {
  const client = new SecretsManagerClient();
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  if (!SecretString) throw new Error(`Secret ${secretId} has no string value`);
  return JSON.parse(SecretString);
}

async function getParameter(name: string): Promise<string> {
  const client = new SSMClient();
  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: name })
  );
  if (!Parameter?.Value)
    throw new Error(`SSM parameter ${name} has no value`);
  return Parameter.Value;
}

// ---------------------------------------------------------------------------
// Shared interface
// ---------------------------------------------------------------------------

export interface BaseTokenGenerator {
  getToken(): Promise<string>;
}

// ---------------------------------------------------------------------------
// StubTokenGenerator  (mirrors StubTokenGenerator.ts)
// ---------------------------------------------------------------------------

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

class StubTokenGenerator implements BaseTokenGenerator {
  constructor(
    private privateKey: CryptoKey,
    private kid: string,
    private publicN: string
  ) {}

  async getToken(): Promise<string> {
    const sub = "d6a2b234-e011-7084-f347-912225bd2861";

    return new SignJWT({
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
      .setExpirationTime("1h")
      .sign(this.privateKey);
  }
}

export async function getStubTokenGenerator(): Promise<BaseTokenGenerator> {
  const rawSecret = await getSecret(
    "/development/flex-secret/auth/e2e/private_jwk"
  );
  const privateKeyData = PrivateKeySchema.parse(rawSecret);
  const privateKey = (await importJWK(privateKeyData as JWK, "RS256")) as CryptoKey;
  return new StubTokenGenerator(privateKey, privateKeyData.kid, privateKeyData.n);
}

// ---------------------------------------------------------------------------
// TokenGenerator  (mirrors TokenGenerator.ts — used for staging / production)
// ---------------------------------------------------------------------------

interface JwtAuthConfig {
  email: string;
  password: string;
  totp: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  redirectUri: string;
  oneLoginEnvironment: string;
}

interface TokenResponse {
  access_token: string;
}

class RealTokenGenerator implements BaseTokenGenerator {
  private client: AxiosInstance;

  constructor(private config: JwtAuthConfig) {
    const jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
  }

  async getToken(): Promise<string> {
    const { csrfToken, code_verifier } = await this.startAuthFlow();
    const code = await this.submitFormsAndGetCode(csrfToken);
    const tokens = await this.exchangeCodeForTokens(code, code_verifier);
    return tokens.access_token;
  }

  private async startAuthFlow(): Promise<{
    csrfToken: string;
    code_verifier: string;
  }> {
    const { code_verifier, code_challenge } = await pkceChallenge();
    const query = querystring.stringify({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: `http://${this.config.redirectUri}`,
      scope: "openid email",
      code_challenge,
      code_challenge_method: "S256",
      state: "debug123",
      idpidentifier: "onelogin",
    });

    const response = await this.client.get<string>(
      `https://${this.config.authUrl}/oauth2/authorize?${query}`
    );
    const $ = load(response.data);
    const csrfToken = $('input[name="_csrf"]').val() as string;

    if (!csrfToken) throw new Error("Could not find CSRF token");
    return { csrfToken, code_verifier };
  }

  private async submitFormsAndGetCode(csrfToken: string): Promise<string> {
    const oneLoginDomain = `signin.${this.config.oneLoginEnvironment}.account.gov.uk`;
    let capturedCode: string | undefined;

    const server = createServer((req, res) => {
      const host = req.headers.host ?? this.config.redirectUri;
      const url = new URL(req.url || "", `http://${host}`);
      capturedCode = url.searchParams.get("code") ?? undefined;
      res.writeHead(200);
      res.end("Captured");
    });

    await new Promise<void>((resolve) => server.listen(3000, resolve));

    try {
      const post = (path: string, data: object) =>
        this.client.post(
          `https://${oneLoginDomain}${path}`,
          querystring.stringify({ _csrf: csrfToken, ...data })
        );

      await post("/sign-in-or-create?", {});
      await post("/enter-email?", { email: this.config.email });
      await post("/enter-password?", { password: this.config.password });

      const { otp } = await TOTP.generate(this.config.totp);
      await post("/enter-authenticator-app-code?", { code: otp });

      if (!capturedCode)
        throw new Error("Redirect happened but no code was found in the URL.");
      return capturedCode;
    } finally {
      server.close();
    }
  }

  private async exchangeCodeForTokens(
    code: string,
    code_verifier: string
  ): Promise<TokenResponse> {
    const response = await fetch(
      `https://${this.config.authUrl}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: querystring.stringify({
          grant_type: "authorization_code",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: `http://${this.config.redirectUri}`,
          code_verifier,
          scope: "email openid",
        }),
      }
    );

    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as TokenResponse;
  }
}

const UserSecretSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp: z.string(),
});

const ClientSecretSchema = z.object({ clientSecret: z.string() });

export async function getTokenGenerator(
  stage: "staging" | "production"
): Promise<BaseTokenGenerator> {
  const [
    userSecretRaw,
    clientSecretRaw,
    clientId,
    oneLoginEnvironment,
    authUrl,
  ] = await Promise.all([
    getSecret(`/${stage}/flex-secret/e2e/test_user`),
    getSecret(`/${stage}/flex-secret/auth/client_secret`),
    getParameter(`/${stage}/flex-param/auth/client-id`),
    getParameter(`/${stage}/flex-param/auth/one-login-environment`),
    getParameter(`/${stage}/flex-param/auth/auth-url`),
  ]);

  const userSecret = UserSecretSchema.parse(userSecretRaw);
  const clientSecret = ClientSecretSchema.parse(clientSecretRaw);

  return new RealTokenGenerator({
    email: userSecret.email,
    password: userSecret.password,
    totp: userSecret.totp,
    clientId,
    clientSecret: clientSecret.clientSecret,
    oneLoginEnvironment,
    authUrl,
    redirectUri: "localhost:3000",
  });
}

// ---------------------------------------------------------------------------
// getJwtClient  (mirrors setup.global.ts)
// ---------------------------------------------------------------------------

export async function getJwtClient(stage: string): Promise<BaseTokenGenerator> {
  if (stage === "staging" || stage === "production") {
    return getTokenGenerator(stage);
  }
  return getStubTokenGenerator();
}
