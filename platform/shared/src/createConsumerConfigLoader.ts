import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { z } from "zod";

export function createConsumerConfigLoader<T>(schema: z.ZodType<T>) {
  return async function loadConsumerConfig(secretArn: string): Promise<T> {
    const config = await getSecret<T>(secretArn, {
      transform: "json",
      maxAge: 600,
    });

    if (!config) {
      throw new Error("Consumer config not found");
    }

    return schema.parseAsync(config);
  };
}
