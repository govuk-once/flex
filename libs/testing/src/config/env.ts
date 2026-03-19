import { sanitiseStageName, Url } from "@flex/utils";
import { z } from "zod";

export const e2eEnvSchema = z.object({
  FLEX_API_URL: Url.describe("Base URL of the deployed API"),
  FLEX_PRIVATE_GATEWAY_URL: Url.describe(
    "Base URL of the deployed private gateway",
  ),
  FLEX_PUBLIC_EXECUTE_API_URL: Url.describe(
    "Direct execute-api URL of the public REST API (should be disabled)",
  ),
  JWT: z.object({
    VALID: z.string(),
    INVALID: z.string(),
  }),
  STAGE: z
    .string()
    .optional()
    .transform(
      (v) =>
        sanitiseStageName(v ?? process.env.STAGE ?? process.env.USER) ??
        "development",
    )
    .describe(
      "Environment name (<username>, pr-<number>, development, staging, production)",
    ),
});

export type E2EEnv = z.output<typeof e2eEnvSchema>;

export const flexStackOutputsSchema = z.object({
  FlexApiUrl: z.url().describe("Flex Platform API URL"),
  PrivateGatewayUrl: z.url().describe("Private API Gateway URL"),
  PublicApiExecuteUrl: z
    .url()
    .describe("Direct execute-api URL of the public REST API"),
});

export type FlexStackOutputs = z.output<typeof flexStackOutputsSchema>;
