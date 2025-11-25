import type { UserDataPlatformPort } from '../../../domain/ports/UserDataPlatformPort';

/**
 * Use case for deleting user settings from the User Data Platform
 */
export class DeleteSettingsUseCase {
  constructor(private readonly userDataPlatform: UserDataPlatformPort) {}

  async execute(userId: string): Promise<void> {
    if (!userId || userId.trim() === '') {
      throw new Error('UserId is required');
    }

    return await this.userDataPlatform.deleteUserData(userId);
  }
}
