import { vi } from 'vitest';
import type { AuthTokenProviderPort } from '../domain/ports/AuthTokenProviderPort';
import type { UserDataPlatformPort } from '../domain/ports/UserDataPlatformPort';
import type { UserDataResponse } from '../domain/models/UserData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

export type MockAuthTokenProvider = AuthTokenProviderPort & {
  getAccessToken: MockFn<() => Promise<string>>;
  setToken: (token: string) => void;
};

export type MockUserDataPlatform = UserDataPlatformPort & {
  getUserData: MockFn<(userId: string) => Promise<UserDataResponse>>;
  writeUserData: MockFn<
    (userId: string, data: Record<string, unknown>) => Promise<UserDataResponse>
  >;
  deleteUserData: MockFn<(userId: string) => Promise<void>>;
};

export const createMockAuthTokenProvider = (
  initialToken = 'test-access-token',
): MockAuthTokenProvider => {
  const mock: MockAuthTokenProvider = {
    getAccessToken: vi
      .fn<() => Promise<string>>()
      .mockResolvedValue(initialToken),
    setToken: (token: string) => {
      mock.getAccessToken.mockResolvedValue(token);
    },
  };

  return mock;
};

export const createMockUserDataPlatform = (
  overrides: Partial<MockUserDataPlatform> = {},
): MockUserDataPlatform => {
  const mock: MockUserDataPlatform = {
    getUserData: vi
      .fn<(userId: string) => Promise<UserDataResponse>>()
      .mockRejectedValue(new Error('getUserData not implemented')),
    writeUserData: vi
      .fn<
        (
          userId: string,
          data: Record<string, unknown>,
        ) => Promise<UserDataResponse>
      >()
      .mockRejectedValue(new Error('writeUserData not implemented')),
    deleteUserData: vi
      .fn<(userId: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    ...overrides,
  };

  return mock;
};
