import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { z, ZodObject } from "zod";

/**
 * A generic helper to fetch and validate gateway secrets.
 * @param secretArn - The AWS ARN for the secret
 * @param schema - The Zod schema to validate the secret against
 */
export async function getConsumerConfig<T extends ZodObject>(
  secretArn: string,
  schema: T,
): Promise<z.infer<T>> {
  const config = await getSecret(secretArn, {
    transform: "json",
    maxAge: 600, // 10 minutes cache
  });

  if (!config) {
    throw new Error(`Gateway config not found for secret: ${secretArn}`);
  }

  // Use parseAsync to handle any async refinements in the schema
  return schema.parseAsync(config);
}
