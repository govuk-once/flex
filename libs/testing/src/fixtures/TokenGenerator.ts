import querystring from "node:querystring";

import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { load } from "cheerio";
import pkceChallenge from "pkce-challenge";
import { TOTP } from "totp-generator";
import { CookieJar } from "tough-cookie";
import { z } from "zod";

export interface BaseTokenGenerator {
  getToken(): Promise<string>;
}

export interface OneLoginAuthConfig {
  email: string;
  password: string;
  totp: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  redirectUri: string;
  oneLoginEnvironment: string;
  attestationToken?: string;
}

export async function getAccessToken(
  config: OneLoginAuthConfig,
): Promise<string> {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  );

  const { code_verifier, code_challenge } = await pkceChallenge();
  const query = querystring.stringify({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: "openid email",
    code_challenge,
    code_challenge_method: "S256",
    state: "smoke-test",
    idpidentifier: "onelogin",
  });

  const initResponse = await client.get<string>(
    `https://${config.authUrl}/oauth2/authorize?${query}`,
    {
      headers: {
        ...(config.attestationToken && {
          "X-Firebase-App-Check": config.attestationToken,
        }),
      },
    },
  );

  const $ = load(initResponse.data);
  const csrfToken = $('input[name="_csrf"]').val() as string;
  if (!csrfToken) throw new Error("Could not find CSRF token in auth response");

  const oneLoginDomain = `signin.${config.oneLoginEnvironment}.account.gov.uk`;
  const post = (path: string, data: object) =>
    client.post(
      `https://${oneLoginDomain}${path}`,
      querystring.stringify({ _csrf: csrfToken, ...data }),
    );

  await post("/sign-in-or-create?", {});
  await post("/enter-email?", { email: config.email });
  await post("/enter-password?", { password: config.password });

  const { otp } = await TOTP.generate(config.totp);

  let codeRedirectUrl: string | undefined;

  try {
    await client.post(
      `https://${oneLoginDomain}/enter-authenticator-app-code?`,
      querystring.stringify({ _csrf: csrfToken, code: otp }),
      {
        beforeRedirect: (
          _options: Record<string, unknown>,
          responseDetails: { headers: Record<string, string> },
        ) => {
          codeRedirectUrl = responseDetails.headers["location"];
        },
      },
    );
  } catch (error) {
    if (!codeRedirectUrl) throw error;
  }

  if (!codeRedirectUrl) throw new Error("TOTP step did not produce a redirect");

  const code = new URL(codeRedirectUrl).searchParams.get("code");
  if (!code) throw new Error("No code found in redirect URL");

  const response = await fetch(`https://${config.authUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: querystring.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier,
      scope: "email openid",
    }),
  });

  if (!response.ok)
    throw new Error(`Token exchange failed: ${await response.text()}`);

  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}

class TokenGenerator implements BaseTokenGenerator {
  constructor(private readonly config: OneLoginAuthConfig) {}

  async getToken(): Promise<string> {
    try {
      return await getAccessToken(this.config);
    } catch (error) {
      console.error("Failed to execute E2E login flow:", error);
      throw error;
    }
  }
}

const UserSecretSchema = z.object({
  email: z.email(),
  password: z.string(),
  totp: z.string(),
});

const ClientSecretSchema = z.object({
  clientSecret: z.string(),
});

export async function getTokenGenerator(
  stage: "staging" | "production",
): Promise<TokenGenerator> {
  const [
    userSecretRaw,
    clientSecretRaw,
    clientId,
    oneLoginEnvironment,
    authUrl,
  ] = await Promise.all([
    getSecret(`/${stage}/flex-secret/e2e/test_user`, { transform: "json" }),
    getSecret(`/${stage}/flex-secret/auth/client_secret`, {
      transform: "json",
    }),
    getParameter(`/${stage}/flex-param/auth/client-id`),
    getParameter(`/${stage}/flex-param/auth/one-login-environment`),
    getParameter(`/${stage}/flex-param/auth/auth-url`),
  ]);

  const userSecret = UserSecretSchema.parse(userSecretRaw);
  const clientSecret = ClientSecretSchema.parse(clientSecretRaw);

  return new TokenGenerator({
    email: userSecret.email,
    password: userSecret.password,
    totp: userSecret.totp,
    clientId: clientId as string,
    clientSecret: clientSecret.clientSecret,
    oneLoginEnvironment: oneLoginEnvironment as string,
    authUrl: authUrl as string,
    redirectUri: "govuk://govuk/login-auth-callback",
  });
}
