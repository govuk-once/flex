import { MiddlewareObj } from "@middy/core";
import secretsManager, { secret } from "@middy/secrets-manager";
import type { Context } from "aws-lambda";

type SecretsManagerOptions = Parameters<typeof secretsManager>[0];

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
  /**
   * Additional options to pass through to secretsManager.
   * These options will be merged with the default configuration.
   */
  options?: Omit<SecretsManagerOptions, "fetchData" | "setToContext">;
}): MiddlewareObj<unknown, unknown, Error, Context & TSecrets> {
  return secretsManager({
    ...opts.options,
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
