import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTopicsUseCase } from './CreateTopicsUseCase';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../../testing/mocks';

describe('CreateTopicsUseCase', () => {
  let mockUserDataPlatform: MockUserDataPlatform;
  let useCase: CreateTopicsUseCase;

  beforeEach(() => {
    mockUserDataPlatform = createMockUserDataPlatform();

    useCase = new CreateTopicsUseCase(mockUserDataPlatform);
  });

  it('should create user topics successfully', async () => {
    const userId = 'user-123';
    const topics = { topic1: 'value1', topic2: 'value2' };
    const mockResponse = {
      userId,
      data: topics,
    };

    vi.mocked(mockUserDataPlatform.writeUserData).mockResolvedValue(
      mockResponse,
    );

    const result = await useCase.execute(userId, topics);

    expect(result).toEqual(mockResponse);
    expect(mockUserDataPlatform.writeUserData).toHaveBeenCalledWith(
      userId,
      topics,
    );
  });

  it('should throw error when user data platform fails', async () => {
    const userId = 'user-123';
    const topics = { topic1: 'value1' };
    const error = new Error('Write failed');

    vi.mocked(mockUserDataPlatform.writeUserData).mockRejectedValue(error);

    await expect(useCase.execute(userId, topics)).rejects.toThrow(
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
