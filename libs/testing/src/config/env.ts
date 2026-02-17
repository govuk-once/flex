import { sanitiseStageName } from "@flex/utils";
import { z } from "zod";

export const e2eEnvSchema = z.object({
  FLEX_API_URL: z.url().describe("Base URL of the deployed API"),
  FLEX_PRIVATE_GATEWAY_URL: z
    .url()
    .describe(
      "Private API Gateway URL (only reachable from within VPC, used to verify direct access is blocked)",
    ),
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
