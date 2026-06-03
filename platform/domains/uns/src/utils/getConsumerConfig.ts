import { createConsumerConfigLoader } from "@flex/platform-shared";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const consumerConfigSchema = z.object({
  apiUrl: NonEmptyString,
  region: NonEmptyString,
  consumerRoleArn: NonEmptyString,
  externalId: NonEmptyString.optional(),
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;

export const getConsumerConfig =
  createConsumerConfigLoader(consumerConfigSchema);
