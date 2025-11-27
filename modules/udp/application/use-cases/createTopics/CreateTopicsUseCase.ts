import type { UserDataPlatformPort } from '../../../domain/ports/UserDataPlatformPort';
import type { UserDataResponse } from '../../../domain/models/UserData';

/**
 * Use case for creating/updating user topics in the User Data Platform
 */
export class CreateTopicsUseCase {
  constructor(private readonly userDataPlatform: UserDataPlatformPort) {}

  async execute(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<UserDataResponse> {
    if (!userId || userId.trim() === '') {
      throw new Error('UserId is required');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('Data is required and cannot be empty');
    }

    return await this.userDataPlatform.writeUserData(userId, data);
  }
}
