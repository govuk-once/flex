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
    return await this.userDataPlatform.writeUserData(userId, data);
  }
}
