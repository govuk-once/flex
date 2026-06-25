import { getStubTokenGenerator } from "@flex/testing/auth";
import {
  getAccessToken,
  type OneLoginAuthConfig as AuthConfig,
} from "@flex/testing/auth";

import { loadApiUrl, loadConfig, loadGcpConfig } from "./config";
import { getAttestationToken } from "./gcp";

export interface Credentials {
  accessToken: string;
  attestationToken: string | undefined;
  apiUrl: string;
}

async function getDevelopmentCredentials(): Promise<Credentials> {
  const [stubGen, gcpConfig, apiUrl] = await Promise.all([
    getStubTokenGenerator(),
    loadGcpConfig("development"),
    loadApiUrl(),
  ]);
  const [accessToken, attestationToken] = await Promise.all([
    stubGen.getToken(),
    getAttestationToken(
      gcpConfig.gcpCredentialConfig,
      gcpConfig.gcpServiceAccountEmail,
      gcpConfig.firebaseAppId,
    ),
  ]);
  return { accessToken, attestationToken, apiUrl };
}

async function getStagingCredentials(env: string): Promise<Credentials> {
  const config = await loadConfig(env);
  const accessToken = await getAccessToken(toAuthConfig(config));
  return { accessToken, attestationToken: undefined, apiUrl: config.apiUrl };
}

async function getProductionCredentials(): Promise<Credentials> {
  const [config, gcpConfig] = await Promise.all([
    loadConfig("production"),
    loadGcpConfig("production"),
  ]);
  const [accessToken, attestationToken] = await Promise.all([
    getAccessToken(toAuthConfig(config)),
    getAttestationToken(
      gcpConfig.gcpCredentialConfig,
      gcpConfig.gcpServiceAccountEmail,
      gcpConfig.firebaseAppId,
    ),
  ]);
  return { accessToken, attestationToken, apiUrl: config.apiUrl };
}

function toAuthConfig(
  config: Awaited<ReturnType<typeof loadConfig>>,
): AuthConfig {
  return {
    email: config.userEmail,
    password: config.userPassword,
    totp: config.userTotp,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authUrl: config.authUrl,
    redirectUri: config.redirectUri,
    oneLoginEnvironment: config.oneLoginEnvironment,
  };
}

export function resolveCredentials(env: string): Promise<Credentials> {
  if (env === "development") return getDevelopmentCredentials();
  if (env === "production") return getProductionCredentials();
  return getStagingCredentials(env);
}
