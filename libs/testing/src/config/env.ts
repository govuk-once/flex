import { sanitiseStageName, Url } from "@flex/utils";
import { z } from "zod";

export const e2eEnvSchema = z.object({
  FLEX_API_URL: Url.describe("Base URL of the deployed API"),
  FLEX_PRIVATE_GATEWAY_URL: Url.describe(
    "Base URL of the deployed private gateway",
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
});

export type FlexStackOutputs = z.output<typeof flexStackOutputsSchema>;

export const flexPrivateGatewayStackOutputsSchema = z.object({
  PrivateGatewayUrl: z.url().describe("Private API Gateway URL"),
});

export type FlexPrivateGatewayStackOutputs = z.output<
  typeof flexPrivateGatewayStackOutputsSchema
>;
