import type { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';

export interface ClientCredentialsConfig {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Adapter implementing OAuth2 client credentials flow
 * Handles token caching and automatic refresh
 */
export class ClientCredentialsProvider implements AuthTokenProviderPort {
  private config: ClientCredentialsConfig;
  private cachedToken: CachedToken | null = null;

  constructor(config: ClientCredentialsConfig) {
    this.config = config;
  }

  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    // Fetch new token
    const tokenResponse = await this.fetchToken();

    if (!tokenResponse.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }

    // Cache token with expiry buffer (subtract 60 seconds for safety)
    const expiresIn = tokenResponse.expires_in || 3600;
    this.cachedToken = {
      token: tokenResponse.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };

    return tokenResponse.access_token;
  }

  private async fetchToken(): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to obtain access token: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as TokenResponse;
  }
}
