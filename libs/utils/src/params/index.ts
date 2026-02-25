import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { z } from "zod";

/**
 * Retrieves a secret from AWS Secrets Manager, parses the JSON string,
 * and validates it against a provided Zod schema.
 *
 * @template T - The expected shape of the secret data after validation.
 * @param client - An instance of the AWS SecretsManagerClient.
 * @param secretId - The ARN or name of the secret to retrieve.
 * @param schema - A Zod schema used to validate and type-cast the secret data.
 * @returns A promise that resolves to the validated secret object of type T.
 * @throws {Error} If the secret string is missing or empty.
 * @throws {ZodError} If the parsed JSON does not match the provided schema.
 */
export const getValidatedSecret = async <T>(
  client: SecretsManagerClient,
  secretId: string,
  schema: z.ZodType<T>,
): Promise<T> => {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) {
    throw new Error(`Secret "${secretId}" is empty or not found`);
  }

  const rawData: unknown = JSON.parse(response.SecretString);
  return schema.parse(rawData);
};

/**
 * Retrieves a parameter value from AWS Systems Manager (SSM) Parameter Store.
 *
 * @param client - An instance of the AWS SSMClient.
 * @param paramId - The name of the parameter to retrieve.
 * @returns A promise that resolves to the parameter value as a string.
 * @throws {Error} If the parameter or its value is not found or is empty.
 */
export const getValidatedParameter = async (
  client: SSMClient,
  paramId: string,
): Promise<string> => {
  const response = await client.send(
    new GetParameterCommand({ Name: paramId }),
  );

  if (!response.Parameter || response.Parameter.Value === undefined) {
    throw new Error(`Parameter "${paramId}" is empty or not found`);
  }

  return response.Parameter.Value;
};
