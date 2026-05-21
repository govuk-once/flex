import { createConsumerConfigLoader } from "@flex/platform-shared";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const consumerConfigSchema = z.object({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
  apiPublicKey: NonEmptyString,
  apiUsername: NonEmptyString,
  apiPassword: NonEmptyString,
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;

export const getConsumerConfig =
  createConsumerConfigLoader(consumerConfigSchema);
