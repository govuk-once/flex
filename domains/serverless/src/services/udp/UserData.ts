import z from 'zod';

/**
 * Domain model representing user data stored in the User Data Platform
 */
const UserDataZod = z.object({
  userId: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type UserData = z.infer<typeof UserDataZod>;

const WriteUserDataRequestZod = z.union([UserDataZod, z.object({})]);
export type WriteUserDataRequest = z.infer<typeof WriteUserDataRequestZod>;

const UserDataResponseZod = z.union([UserDataZod, z.object({})]);
export type UserDataResponse = z.infer<typeof UserDataResponseZod>;
