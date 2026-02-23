import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { z } from "zod";

const consumerConfigSchema = z.object({
  region: z.string().min(1),
  apiAccountId: z.string().min(1),
  apiUrl: z.string().min(1),
  apiKey: z.string().min(1),
  consumerRoleArn: z.string().min(1),
  externalId: z.string().optional(),
});

export type ConsumerConfig = z.output<typeof consumerConfigSchema>;

export async function getConsumerConfig(
  secretArn: string,
): Promise<ConsumerConfig> {
  const config = await getSecret(secretArn);
  if (!config) {
    throw new Error("Consumer config not found");
  }
  return consumerConfigSchema.parse(JSON.parse(config as string));
}
