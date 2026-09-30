import { z } from "zod";

const jsonArray = <T extends z.ZodType>(item: T) =>
  z
    .string()
    .transform((value): unknown => JSON.parse(value))
    .pipe(z.array(item));

const ManualRotationSecretSchema = z.object({
  secretId: z.string().min(1),
  cadenceDays: z.number().int().positive(),
});

const CognitoParameterSchema = z.object({
  parameterName: z.string().min(1),
  environmentVariable: z.string().min(1),
});

const ConfigSchema = z.object({
  FLEX_ENVIRONMENT: z.string().min(1),
  AUTHORIZER_FUNCTION_ARN: z.string().min(1),
  MANUAL_ROTATION_SECRETS: jsonArray(ManualRotationSecretSchema),
  COGNITO_PARAMETERS: jsonArray(CognitoParameterSchema),
});

export type ManualRotationSecret = z.infer<typeof ManualRotationSecretSchema>;
export type CognitoParameter = z.infer<typeof CognitoParameterSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse(process.env);
}
