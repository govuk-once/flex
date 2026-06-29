import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { z } from "zod";

const UserSecretSchema = z.object({
  email: z.email(),
  password: z.string(),
  totp: z.string(),
});

export interface SmokeTestConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  oneLoginEnvironment: string;
  apiUrl: string;
  userEmail: string;
  userPassword: string;
  userTotp: string;
}

export interface GcpConfig {
  gcpCredentialConfig: string;
  gcpServiceAccountEmail: string;
  firebaseAppId: string;
}

export async function loadApiUrl(): Promise<string> {
  return (await getParameter(`/infra/dns/hostedzonename`, {
    forceFetch: true,
  })) as string;
}

export async function loadConfig(env: string): Promise<SmokeTestConfig> {
  const paramPrefix = `/${env}/flex-param`;

  const [
    authUrl,
    tokenUrl,
    clientId,
    oneLoginEnvironment,
    apiUrl,
    userSecretRaw,
  ] = await Promise.all([
    getParameter(`${paramPrefix}/auth/auth-url`, { forceFetch: true }),
    getParameter(`${paramPrefix}/auth/token-url`, { forceFetch: true }),
    getParameter(`${paramPrefix}/auth/client-id`, { forceFetch: true }),
    getParameter(`${paramPrefix}/auth/one-login-environment`, {
      forceFetch: true,
    }),
    getParameter(`/infra/dns/hostedzonename`, { forceFetch: true }),
    getSecret(`/${env}/flex-secret/smoke-test/user`, {
      transform: "json",
      forceFetch: true,
    }),
  ]);

  const user = UserSecretSchema.parse(userSecretRaw);

  return {
    authUrl: authUrl as string,
    tokenUrl: tokenUrl as string,
    clientId: clientId as string,
    redirectUri: "govuk://govuk/login-auth-callback",
    oneLoginEnvironment: oneLoginEnvironment as string,
    apiUrl: apiUrl as string,
    userEmail: user.email,
    userPassword: user.password,
    userTotp: user.totp,
  };
}

export async function loadGcpConfig(env: string): Promise<GcpConfig> {
  const ssmPrefix = `/${env}/flex/smoke-test`;

  const [gcpCredentialConfig, gcpServiceAccountEmail, firebaseAppId] =
    await Promise.all([
      getParameter(`${ssmPrefix}/gcp-credential-config`, {
        forceFetch: true,
        decrypt: true,
      }),
      getParameter(`${ssmPrefix}/gcp-service-account-email`, {
        forceFetch: true,
      }),
      getParameter(`${ssmPrefix}/firebase-app-id`, { forceFetch: true }),
    ]);

  return {
    gcpCredentialConfig: gcpCredentialConfig as string,
    gcpServiceAccountEmail: gcpServiceAccountEmail as string,
    firebaseAppId: firebaseAppId as string,
  };
}
