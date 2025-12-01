import type { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import type { UserDataResponse } from '../../domain/models/UserData';
import type { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';
import { ResponseError } from '../../../common/errors/ResponseError';
import { ClientCredentialsProvider } from '../auth/ClientCredentialsProvider';

export interface UdpHttpClientConfig {
  baseUrl: string;
  authTokenProvider: AuthTokenProviderPort;
}

/**
 * HTTP adapter implementing the UserDataPlatformPort
 * This is a shared resource that can be reused across multiple use cases
 */

const config = {
  baseUrl: process.env.UDP_BASE_URL || '',
  authTokenProvider: new ClientCredentialsProvider({
    tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
    clientId: process.env.UDP_CLIENT_ID || '',
    clientSecret: process.env.UDP_CLIENT_SECRET || '',
    scope: process.env.UDP_SCOPE || 'udp:write',
  }),
};

export async function getUserData(userId: string): Promise<UserDataResponse> {
  const token = await config.authTokenProvider.getAccessToken();
  const url = `${config.baseUrl}/users/${userId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new ResponseError(
      `Failed to get user data ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as UserDataResponse;
}

export async function writeUserData(
  userId: string,
  data: Record<string, unknown>,
): Promise<UserDataResponse> {
  const token = await config.authTokenProvider.getAccessToken();
  const url = `${config.baseUrl}/users/${userId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to write user data: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as UserDataResponse;
}

export async function deleteUserData(userId: string): Promise<void> {
  const token = await config.authTokenProvider.getAccessToken();
  const url = `${config.baseUrl}/users/${userId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to delete user data: ${response.status} ${response.statusText}`,
    );
  }
}
