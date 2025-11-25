import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSettingsUseCase } from './GetSettingsUseCase';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../../testing/mocks';

describe('GetSettingsUseCase', () => {
  let mockUserDataPlatform: MockUserDataPlatform;
  let useCase: GetSettingsUseCase;

  beforeEach(() => {
    mockUserDataPlatform = createMockUserDataPlatform();

    useCase = new GetSettingsUseCase(mockUserDataPlatform);
  });

  it('should retrieve user settings successfully', async () => {
    const userId = 'user-123';
    const mockUserData = {
      userId,
      data: { theme: 'dark', notifications: true },
    };

    vi.mocked(mockUserDataPlatform.getUserData).mockResolvedValue(mockUserData);

    const result = await useCase.execute(userId);

    expect(result).toEqual(mockUserData);
    expect(mockUserDataPlatform.getUserData).toHaveBeenCalledWith(userId);
  });

  it('should throw error when user data platform fails', async () => {
    const userId = 'user-123';
    const error = new Error('User not found');

    vi.mocked(mockUserDataPlatform.getUserData).mockRejectedValue(error);

    await expect(useCase.execute(userId)).rejects.toThrow('User not found');
  });

  it('should validate userId is provided', async () => {
    await expect(useCase.execute('')).rejects.toThrow('UserId is required');
  });
});
