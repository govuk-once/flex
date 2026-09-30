import { z } from "zod";

const jsonArray = <T extends z.ZodType>(item: T) =>
  z
    .string()
    .transform((value): unknown => JSON.parse(value))
    .pipe(z.array(item));

const MaximumAgeSecretSchema = z.object({
  secretId: z.string().min(1),
  maxAgeDays: z.number().int().positive(),
});

const CognitoParameterSchema = z.object({
  parameterName: z.string().min(1),
  environmentVariable: z.string().min(1),
});

const ConfigSchema = z.object({
  AWS_REGION: z.string().min(1),
  FLEX_ENVIRONMENT: z.string().min(1),
  AUTHORIZER_FUNCTION_ARN: z.string().min(1),
  MAXIMUM_ROTATION_INTERVAL_DAYS: z.coerce.number().int().positive(),
  MAXIMUM_AGE_SECRETS: jsonArray(MaximumAgeSecretSchema),
  COGNITO_PARAMETERS: jsonArray(CognitoParameterSchema),
});

export type MaximumAgeSecret = z.infer<typeof MaximumAgeSecretSchema>;
export type CognitoParameter = z.infer<typeof CognitoParameterSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse(process.env);
}
