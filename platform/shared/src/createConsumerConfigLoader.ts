import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { z } from "zod";

export function createConsumerConfigLoader<T>(schema: z.ZodType<T>) {
  return async function loadConsumerConfig(secretArn: string): Promise<T> {
    // Wild attempt at getting move verbose error responses
    console.log(`Fetching config using getSecret`);
    // // // if (secretArn.includes(`uns-dev`)) {
    // // //   return schema.parseAsync(
    // // //     JSON.parse(
    // // //       (
    // // //         await new SecretsManagerClient({
    // // //           region: "eu-west-2",
    // // //         }).send(
    // // //           new GetSecretValueCommand({
    // // //             SecretId: secretArn,
    // // //           }),
    // // //         )
    // // //       ).SecretString ?? "{}",
    // // //     ),
    // // //   );
    // // // }
    const config = await getSecret<T>(secretArn, {
      transform: "json",
      maxAge: 600,
      forceFetch: true,
    });

    if (!config) {
      throw new Error("Consumer config not found");
    }

    return schema.parseAsync(config);
  };
}
