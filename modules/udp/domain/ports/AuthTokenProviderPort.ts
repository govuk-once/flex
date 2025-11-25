/**
 * Port defining the contract for obtaining authentication tokens
 * Used for client credentials OAuth2 flow
 */
export interface AuthTokenProviderPort {
  /**
   * Retrieves a valid access token using client credentials
   * Should handle token caching and refresh automatically
   * @returns Promise resolving to a valid access token
   * @throws Error if authentication fails
   */
  getAccessToken(): Promise<string>;
}
