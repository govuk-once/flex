import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const consumerConfigSchema = z.object({
  apiUrl: NonEmptyString,
  apiKey: NonEmptyString,
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;

export async function getConsumerConfig(
  secretArn: string,
): Promise<ConsumerConfig> {
  const config = await getSecret<ConsumerConfig>(secretArn, {
    transform: "json",
    maxAge: 600,
  });

  if (!config) {
    throw new Error("Consumer config not found");
  }
  return consumerConfigSchema.parseAsync(config);
}
