/**
 * Domain model representing user data stored in the User Data Platform
 */
export interface UserData {
  userId: string;
  data: Record<string, unknown>;
}

/**
 * Request payload for writing user data
 */
export interface WriteUserDataRequest {
  userId: string;
  data: Record<string, unknown>;
}

/**
 * Response from UDP operations
 */
export interface UserDataResponse {
  userId: string;
  data: Record<string, unknown>;
}
