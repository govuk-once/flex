import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientCredentialsProvider } from './ClientCredentialsProvider';
import type { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';

describe('ClientCredentialsProvider', () => {
  const mockTokenEndpoint = 'https://auth.example.com/oauth/token';
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';
  const mockScope = 'udp:read udp:write';

  let provider: AuthTokenProviderPort;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClientCredentialsProvider({
      tokenEndpoint: mockTokenEndpoint,
      clientId: mockClientId,
      clientSecret: mockClientSecret,
      scope: mockScope,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAccessToken', () => {
    it('should fetch and return an access token', async () => {
      const mockToken = 'mock-access-token-123';
      const mockResponse = {
        access_token: mockToken,
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const token = await provider.getAccessToken();

      expect(token).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledWith(mockTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: mockClientId,
          client_secret: mockClientSecret,
          scope: mockScope,
        }).toString(),
      });
    });

    it('should cache tokens and reuse them until expiry', async () => {
      const mockToken = 'cached-token-123';
      const mockResponse = {
        access_token: mockToken,
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const token1 = await provider.getAccessToken();
      const token2 = await provider.getAccessToken();

      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh token when expired', async () => {
      const mockToken1 = 'token-1';
      const mockToken2 = 'token-2';
      const mockResponse1 = {
        access_token: mockToken1,
        token_type: 'Bearer',
        expires_in: 1, // Very short expiry
      };
      const mockResponse2 = {
        access_token: mockToken2,
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        } as Response);

      const token1 = await provider.getAccessToken();

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const token2 = await provider.getAccessToken();

      expect(token1).toBe(mockToken1);
      expect(token2).toBe(mockToken2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when token request fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(provider.getAccessToken()).rejects.toThrow(
        'Failed to obtain access token: 401 Unauthorized',
      );
    });

    it('should throw error when network request fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.getAccessToken()).rejects.toThrow('Network error');
    });

    it('should throw error when response is missing access_token', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token_type: 'Bearer' }),
      } as Response);

      await expect(provider.getAccessToken()).rejects.toThrow(
        'Invalid token response: missing access_token',
      );
    });
  });
});
