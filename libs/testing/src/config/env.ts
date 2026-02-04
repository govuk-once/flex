import {
  CloudfrontDistributionUrlSchema,
  sanitiseStageName,
} from "@flex/utils";
import { z } from "zod";

export const e2eEnvSchema = z.object({
  CLOUDFRONT_DISTRIBUTION_URL: CloudfrontDistributionUrlSchema.describe(
    "Base URL of the deployed CloudFront Distribution",
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
  CloudfrontDistributionUrl: CloudfrontDistributionUrlSchema.describe(
    "Flex Platform CloudFront Distribution URL",
  ),
});

export type FlexStackOutputs = z.output<typeof flexStackOutputsSchema>;
