import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UdpHttpClient } from './UdpHttpClient';
import type { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import {
  createMockAuthTokenProvider,
  MockAuthTokenProvider,
} from '../../testing/mocks';

describe('UdpHttpClient', () => {
  const mockBaseUrl = 'https://udp.example.com/api';
  const mockAccessToken = 'mock-access-token';

  let mockAuthProvider: MockAuthTokenProvider;
  let client: UserDataPlatformPort;

  beforeEach(() => {
    mockAuthProvider = createMockAuthTokenProvider(mockAccessToken);

    client = new UdpHttpClient({
      baseUrl: mockBaseUrl,
      authTokenProvider: mockAuthProvider,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserData', () => {
    it('should fetch user data successfully', async () => {
      const userId = 'user-123';
      const mockUserData = {
        userId,
        data: { name: 'John Doe', email: 'john@example.com' },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response);

      const result = await client.getUserData(userId);

      expect(result).toEqual(mockUserData);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/users/${userId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      expect(mockAuthProvider.getAccessToken).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const userId = 'non-existent-user';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(client.getUserData(userId)).rejects.toThrow(
        'Failed to get user data: 404 Not Found',
      );
    });

    it('should throw error when network request fails', async () => {
      const userId = 'user-123';

      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getUserData(userId)).rejects.toThrow('Network error');
    });
  });

  describe('writeUserData', () => {
    it('should write user data successfully', async () => {
      const userId = 'user-123';
      const data = { name: 'Jane Doe', age: 30 };
      const mockResponse = {
        userId,
        data,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.writeUserData(userId, data);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/users/${userId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data }),
        },
      );
      expect(mockAuthProvider.getAccessToken).toHaveBeenCalled();
    });

    it('should throw error when write fails', async () => {
      const userId = 'user-123';
      const data = { name: 'Jane Doe' };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(client.writeUserData(userId, data)).rejects.toThrow(
        'Failed to write user data: 400 Bad Request',
      );
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data successfully', async () => {
      const userId = 'user-123';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
      } as Response);

      await client.deleteUserData(userId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      expect(mockAuthProvider.getAccessToken).toHaveBeenCalled();
    });

    it('should throw error when deletion fails', async () => {
      const userId = 'user-123';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(client.deleteUserData(userId)).rejects.toThrow(
        'Failed to delete user data: 404 Not Found',
      );
    });
  });
});
