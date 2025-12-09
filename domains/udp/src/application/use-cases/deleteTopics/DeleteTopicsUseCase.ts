import type { UserDataPlatformPort } from '../../../domain/ports/UserDataPlatformPort';

/**
 * Use case for deleting user topics from the User Data Platform
 */
export class DeleteTopicsUseCase {
  constructor(private readonly userDataPlatform: UserDataPlatformPort) {}

  async execute(userId: string): Promise<void> {
    return await this.userDataPlatform.deleteUserData(userId);
  }
}
