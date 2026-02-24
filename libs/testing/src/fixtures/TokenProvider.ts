import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { load } from "cheerio";
import { createServer } from "http";
import { JWK, SignJWT } from "jose";
import pkceChallenge from "pkce-challenge";
import querystring from "querystring";
import { TOTP } from "totp-generator";
import { CookieJar } from "tough-cookie";

/**
 * Interfaces
 */
export interface JwtAuthConfig {
  email: string;
  password: string;
  totpSecret: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  redirectUri: string;
  oneLoginEnvironment: string;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface AuthFlowContext {
  csrfToken: string;
  code_verifier: string;
}

/**
 * Base class
 */
export abstract class BaseTokenProvider {
  abstract getToken(overrides?: {
    exp?: string | number;
    includeUsername?: boolean;
    sub?: string;
  }): Promise<string>;
}

/**
 * StubTokenGenerator class
 */
export class StubTokenGenerator extends BaseTokenProvider {
  constructor(
    private privateKey: CryptoKey,
    public publicJWKS: { keys: JWK[] },
    public kid: string,
  ) {
    super();
  }

  async getToken(
    overrides: {
      exp?: string | number;
      sub?: string;
      includeUsername?: boolean;
    } = {},
  ): Promise<string> {
    const {
      exp = "1h",
      includeUsername = true,
      sub = "d6a2b234-e011-7084-f347-912225bd2861",
    } = overrides;

    const builder = new SignJWT({
      sub,
      "cognito:groups": ["eu-west-2_testUserPoolId_onelogin"],
      iss: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      version: 2,
      client_id: "testClientId",
      token_use: "access",
      scope: "openid email",
      ...(includeUsername && { username: `onelogin_${sub}` }),
    })
      .setProtectedHeader({ alg: "RS256", kid: this.kid, typ: "JWT" })
      .setIssuedAt()
      .setJti(crypto.randomUUID());

    builder.setExpirationTime(exp);

    return await builder.sign(this.privateKey);
  }
}

/**
 * TokenGenerator class
 */
export class TokenGenerator extends BaseTokenProvider {
  private client: AxiosInstance;

  constructor(private config: JwtAuthConfig) {
    super();
    const jar: CookieJar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
  }

  async getToken(): Promise<string> {
    try {
      const { csrfToken, code_verifier } = await this.startAuthFlow();
      const code = await this.submitFormsAndGetCode(csrfToken);
      const tokens = await this.exchangeCodeForTokens(code, code_verifier);
      return tokens.access_token;
    } catch (error) {
      console.error("Failed to execute E2E login flow:", error);
      throw error;
    }
  }

  private async startAuthFlow(): Promise<AuthFlowContext> {
    const { code_verifier, code_challenge } = await pkceChallenge();
    const query = querystring.stringify({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: "openid email",
      code_challenge,
      code_challenge_method: "S256",
      state: "debug123",
      idpidentifier: "onelogin",
    });

    const response = await this.client.get<string>(
      `https://${this.config.authUrl}/oauth2/authorize?${query}`,
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
      const host = req.headers.host ?? "localhost:3000";
      const url = new URL(req.url || "", `http://${host}`);

      capturedCode = url.searchParams.get("code") ?? undefined;

      res.writeHead(200);
      res.end("Captured");
    });

    await new Promise<void>((resolve) =>
      server.listen(3000, () => {
        resolve();
      }),
    );

    try {
      const post = (path: string, data: object) =>
        this.client.post(
          `https://${oneLoginDomain}${path}`,
          querystring.stringify({ _csrf: csrfToken, ...data }),
        );

      await post("/sign-in-or-create?", {});
      await post("/enter-email?", { email: this.config.email });
      await post("/enter-password?", { password: this.config.password });

      const { otp } = await TOTP.generate(this.config.totpSecret);

      await post("/enter-authenticator-app-code?", { code: otp });

      if (!capturedCode) {
        throw new Error("Redirect happened but no code was found in the URL.");
      }

      return capturedCode;
    } finally {
      server.close();
    }
  }

  private async exchangeCodeForTokens(
    code: string,
    code_verifier: string,
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
          redirect_uri: this.config.redirectUri,
          code_verifier,
          scope: "email openid",
        }),
      },
    );

    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as TokenResponse;
  }
}
