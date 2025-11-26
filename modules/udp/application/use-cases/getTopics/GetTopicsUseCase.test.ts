import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetTopicsUseCase } from './GetTopicsUseCase';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../../testing/mocks';

describe('GetTopicsUseCase', () => {
  let mockUserDataPlatform: MockUserDataPlatform;
  let useCase: GetTopicsUseCase;

  beforeEach(() => {
    mockUserDataPlatform = createMockUserDataPlatform();

    useCase = new GetTopicsUseCase(mockUserDataPlatform);
  });

  it('should retrieve user topics successfully', async () => {
    const userId = 'user-123';
    const mockUserData = {
      userId,
      data: { topic1: 'value1', topic2: 'value2' },
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
