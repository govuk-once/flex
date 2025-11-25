import type { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import type { UserDataResponse } from '../../domain/models/UserData';
import type { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';

export interface UdpHttpClientConfig {
  baseUrl: string;
  authTokenProvider: AuthTokenProviderPort;
}

/**
 * HTTP adapter implementing the UserDataPlatformPort
 * This is a shared resource that can be reused across multiple use cases
 */
export class UdpHttpClient implements UserDataPlatformPort {
  private config: UdpHttpClientConfig;

  constructor(config: UdpHttpClientConfig) {
    this.config = config;
  }

  async getUserData(userId: string): Promise<UserDataResponse> {
    const token = await this.config.authTokenProvider.getAccessToken();
    const url = `${this.config.baseUrl}/users/${userId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get user data: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as UserDataResponse;
  }

  async writeUserData(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<UserDataResponse> {
    const token = await this.config.authTokenProvider.getAccessToken();
    const url = `${this.config.baseUrl}/users/${userId}`;

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

  async deleteUserData(userId: string): Promise<void> {
    const token = await this.config.authTokenProvider.getAccessToken();
    const url = `${this.config.baseUrl}/users/${userId}`;

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
}
