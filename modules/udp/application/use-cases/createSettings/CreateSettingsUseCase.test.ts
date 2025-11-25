import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSettingsUseCase } from './CreateSettingsUseCase';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../../testing/mocks';

describe('CreateSettingsUseCase', () => {
  let mockUserDataPlatform: MockUserDataPlatform;
  let useCase: CreateSettingsUseCase;

  beforeEach(() => {
    mockUserDataPlatform = createMockUserDataPlatform();

    useCase = new CreateSettingsUseCase(mockUserDataPlatform);
  });

  it('should create user settings successfully', async () => {
    const userId = 'user-123';
    const settings = { theme: 'light', language: 'en' };
    const mockResponse = {
      userId,
      data: settings,
    };

    vi.mocked(mockUserDataPlatform.writeUserData).mockResolvedValue(
      mockResponse,
    );

    const result = await useCase.execute(userId, settings);

    expect(result).toEqual(mockResponse);
    expect(mockUserDataPlatform.writeUserData).toHaveBeenCalledWith(
      userId,
      settings,
    );
  });

  it('should throw error when user data platform fails', async () => {
    const userId = 'user-123';
    const settings = { theme: 'dark' };
    const error = new Error('Write failed');

    vi.mocked(mockUserDataPlatform.writeUserData).mockRejectedValue(error);

    await expect(useCase.execute(userId, settings)).rejects.toThrow(
      'Write failed',
    );
  });

  it('should validate userId is provided', async () => {
    await expect(useCase.execute('', {})).rejects.toThrow('UserId is required');
  });

  it('should validate data is provided', async () => {
    await expect(useCase.execute('user-123', {})).rejects.toThrow(
      'Data is required and cannot be empty',
    );
  });
});
