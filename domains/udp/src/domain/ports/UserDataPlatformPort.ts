import type { UserDataResponse } from '../models/UserData';

/**
 * Port defining the contract for interacting with the User Data Platform
 * This is implemented by adapters (e.g., HTTP client)
 */
export interface UserDataPlatformPort {
  /**
   * Retrieves user data for a given user ID
   * @param userId - The unique identifier for the user
   * @returns Promise resolving to the user data
   * @throws Error if the request fails or user not found
   */
  getUserData(userId: string): Promise<UserDataResponse>;

  /**
   * Writes/updates user data for a given user ID
   * @param userId - The unique identifier for the user
   * @param data - The data to write
   * @returns Promise resolving to the written user data
   * @throws Error if the request fails
   */
  writeUserData(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<UserDataResponse>;

  /**
   * Deletes user data for a given user ID
   * @param userId - The unique identifier for the user
   * @returns Promise resolving when deletion is complete
   * @throws Error if the request fails
   */
  deleteUserData(userId: string): Promise<void>;
}
