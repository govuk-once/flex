import { createConsumerConfigLoader } from "@flex/platform-shared";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const consumerConfigSchema = z.object({
  apiKey: NonEmptyString,
  roleArn: NonEmptyString,
  privateApiUrl: NonEmptyString,
  region: NonEmptyString,
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;

export const getConsumerConfig =
  createConsumerConfigLoader(consumerConfigSchema);
