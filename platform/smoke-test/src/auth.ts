import querystring from "node:querystring";

import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { load } from "cheerio";
import pkceChallenge from "pkce-challenge";
import { TOTP } from "totp-generator";
import { CookieJar } from "tough-cookie";

export interface AuthConfig {
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

export async function getAccessToken(config: AuthConfig): Promise<string> {
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

  const code = await captureAuthCode(client, config, csrfToken);

  return exchangeCodeForAccessToken(code, code_verifier, config);
}

async function captureAuthCode(
  client: ReturnType<typeof wrapper>,
  config: AuthConfig,
  csrfToken: string,
): Promise<string> {
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

  // ONE Login redirects to the custom scheme (govuk://...) after TOTP.
  // axios can't follow a custom-scheme URL so it throws — we capture the
  // location header via beforeRedirect before that happens.
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

  if (!codeRedirectUrl) {
    throw new Error("TOTP step did not produce a redirect");
  }

  const code = new URL(codeRedirectUrl).searchParams.get("code");
  if (!code) throw new Error("No code found in redirect URL");
  return code;
}

async function exchangeCodeForAccessToken(
  code: string,
  codeVerifier: string,
  config: AuthConfig,
): Promise<string> {
  const response = await fetch(`https://${config.authUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: querystring.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
      scope: "email openid",
    }),
  });

  if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`);

  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}
