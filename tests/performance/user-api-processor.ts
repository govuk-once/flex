import { buildUserPool, pickUserJwt } from "./test-data/jwt-pool.js";

export async function before(): Promise<void> {
  await buildUserPool();
}

export { pickUserJwt };
