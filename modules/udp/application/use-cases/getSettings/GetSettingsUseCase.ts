import type { UserDataPlatformPort } from '../../../domain/ports/UserDataPlatformPort';
import type { UserDataResponse } from '../../../domain/models/UserData';

/**
 * Use case for retrieving user settings from the User Data Platform
 */
export class GetSettingsUseCase {
  constructor(private readonly userDataPlatform: UserDataPlatformPort) {}

  async execute(userId: string): Promise<UserDataResponse> {
    if (!userId || userId.trim() === '') {
      throw new Error('UserId is required');
    }

    return await this.userDataPlatform.getUserData(userId);
  }
}
