import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteSettingsUseCase } from './DeleteSettingsUseCase';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../../testing/mocks';

describe('DeleteSettingsUseCase', () => {
  let mockUserDataPlatform: MockUserDataPlatform;
  let useCase: DeleteSettingsUseCase;

  beforeEach(() => {
    mockUserDataPlatform = createMockUserDataPlatform();

    useCase = new DeleteSettingsUseCase(mockUserDataPlatform);
  });

  it('should delete user settings successfully', async () => {
    const userId = 'user-123';

    vi.mocked(mockUserDataPlatform.deleteUserData).mockResolvedValue(undefined);

    await useCase.execute(userId);

    expect(mockUserDataPlatform.deleteUserData).toHaveBeenCalledWith(userId);
  });

  it('should throw error when user data platform fails', async () => {
    const userId = 'user-123';
    const error = new Error('Delete failed');

    vi.mocked(mockUserDataPlatform.deleteUserData).mockRejectedValue(error);

    await expect(useCase.execute(userId)).rejects.toThrow('Delete failed');
  });

  it('should validate userId is provided', async () => {
    await expect(useCase.execute('')).rejects.toThrow('UserId is required');
  });
});
