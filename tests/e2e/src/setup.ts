import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
config();

/**
 * Schema for E2E test environment variables
 */
const e2eEnvSchema = z.object({
  API_GATEWAY_URL: z
    .string()
    .url("API_GATEWAY_URL must be a valid URL")
    .describe("The base URL of the deployed API Gateway"),
});

/**
 * Validated environment variables for E2E tests
 * This will throw an error at test startup if required env vars are missing or invalid
 */
export const e2eEnv = e2eEnvSchema.parse(process.env);
