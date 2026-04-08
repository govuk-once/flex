import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const configSchema = z.object({
  AWS_REGION: NonEmptyString,
  FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN: NonEmptyString,
});

export const consumerConfigSchema = z.object({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
  apiUsername: NonEmptyString,
  apiPassword: NonEmptyString,
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;
