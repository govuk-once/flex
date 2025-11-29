import type { UserDataPlatformPort } from '../../../domain/ports/UserDataPlatformPort';

/**
 * Use case for deleting user topics from the User Data Platform
 */
export class DeleteTopicsUseCase {
  constructor(private readonly userDataPlatform: UserDataPlatformPort) {}

  async execute(userId: string): Promise<void> {
    if (!userId || userId.trim() === '') {
      throw new Error('UserId is required');
    }

    return await this.userDataPlatform.deleteUserData(userId);
  }
}
