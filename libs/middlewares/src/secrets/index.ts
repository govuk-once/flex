// libs/middlewares/src/secrets.ts
import { MiddlewareObj } from "@middy/core";
import secretsManager, { secret } from "@middy/secrets-manager";
import type { Context } from "aws-lambda";

export function createSecretsMiddleware<
  TSecrets extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(opts: {
  /**
   * Maps context property name -> Secrets Manager secret id
   */
  secrets: { [K in keyof TSecrets & string]: string | undefined };
}): MiddlewareObj<unknown, unknown, Error, Context & TSecrets> {
  return secretsManager({
    fetchData: Object.fromEntries(
      Object.entries(opts.secrets).map(([key, secretId]) => {
        if (!secretId) {
          throw new Error(`Secret id for "${key}" is not defined`);
        }
        return [key, secret(secretId)];
      }),
    ),
    setToContext: true,
  }) as unknown as MiddlewareObj<unknown, unknown, Error, Context & TSecrets>;
}
