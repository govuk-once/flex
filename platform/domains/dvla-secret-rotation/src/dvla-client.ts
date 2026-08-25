import { logger } from "@flex/logging";

interface ChangePasswordParams {
  apiUrl: string;
  userName: string;
  password: string;
  newPassword: string;
}

interface AuthenticateParams {
  apiUrl: string;
  userName: string;
  password: string;
}

interface NewApiKeyParams {
  apiUrl: string;
  currentApiKey: string;
  jwt: string;
}

export async function changePassword({
  apiUrl,
  userName,
  password,
  newPassword,
}: ChangePasswordParams): Promise<void> {
  const response = await fetch(`${apiUrl}/thirdparty-access/v1/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ userName, password, newPassword }),
  });

  if (!response.ok) {
    throw new Error(
      `DVLA password change failed: ${String(response.status)} ${response.statusText}`,
    );
  }

  logger.info("DVLA password changed successfully");
}

export async function authenticate({
  apiUrl,
  userName,
  password,
}: AuthenticateParams): Promise<string> {
  const response = await fetch(`${apiUrl}/thirdparty-access/v1/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ userName, password }),
  });

  if (!response.ok) {
    throw new Error(
      `DVLA authentication failed: ${String(response.status)} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { "id-token": string };
  const jwt = data["id-token"];

  if (!jwt) {
    throw new Error("DVLA authentication response missing id-token");
  }

  logger.info("DVLA authentication successful");
  return jwt;
}

export async function requestNewApiKey({
  apiUrl,
  currentApiKey,
  jwt,
}: NewApiKeyParams): Promise<string> {
  const response = await fetch(`${apiUrl}/thirdparty-access/v1/new-api-key`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "x-api-key": currentApiKey,
      Authorization: jwt,
    },
  });

  if (!response.ok) {
    throw new Error(
      `DVLA new API key request failed: ${String(response.status)} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { newApiKey?: string };
  const newApiKey = data.newApiKey;

  if (!newApiKey) {
    throw new Error("DVLA new-api-key response missing newApiKey");
  }

  logger.info("DVLA new API key issued successfully");
  return newApiKey;
}
