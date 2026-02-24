import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { importJWK, JWK } from "jose";
import { z } from "zod";

import {
  BaseTokenProvider,
  JwtAuthConfig,
  StubTokenGenerator,
  TokenGenerator,
} from "./TokenProvider";

const TestUserSchema = z.object({
  email: z.email(),
  password: z.string(),
  totp: z.string(),
});

const ClientSecretSchema = z.object({
  clientSecret: z.string(),
});

export async function getTokenProvider(): Promise<BaseTokenProvider> {
  const stage = process.env.STAGE ?? process.env.USER ?? "development";

  const useRealProvider = ["staging", "production"].includes(
    stage.toLowerCase(),
  );

  if (useRealProvider) return await getProvider();

  return await getStubProvider();
}

async function getStubProvider(): Promise<StubTokenGenerator> {
  const ssmClient = new SSMClient();
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: "/development/auth/e2e/private_jwk",
      WithDecryption: true,
    }),
  );

  if (!response.Parameter?.Value) {
    throw new Error("Could not find PRIVATE_JWK in Parameter Store");
  }

  const privateKeyData = JSON.parse(response.Parameter.Value) as JWK;

  if (!privateKeyData.kid || !privateKeyData.n) {
    throw new Error("Stored JWK is missing required fields (kid or n)");
  }

  const privateKey = (await importJWK(privateKeyData, "RS256")) as CryptoKey;

  const publicJWKS = {
    keys: [
      {
        alg: "RS256",
        e: "AQAB",
        kty: "RSA",
        n: privateKeyData.n,
        use: "sig",
        kid: privateKeyData.kid,
      },
    ],
  };

  return new StubTokenGenerator(privateKey, publicJWKS, privateKeyData.kid);
}

async function getProvider(): Promise<TokenGenerator> {
  const secretsManagerClient = new SecretsManagerClient();
  const ssmClient = new SSMClient();

  const oneLoginEnvironment = "staging";
  const authUrl = `govukapp-${oneLoginEnvironment}.auth.eu-west-2.amazoncognito.com`;

  const testUser = await getValidatedSecret(
    secretsManagerClient,
    "/development/flex-secret/e2e/test_user",
    TestUserSchema,
  );
  const { clientSecret } = await getValidatedSecret(
    secretsManagerClient,
    "/development/flex-secret/auth/client_secret",
    ClientSecretSchema,
  );
  const clientId = await getValidatedParameter(
    ssmClient,
    "/development/flex-param/auth/client-id",
  );

  const config: JwtAuthConfig = {
    email: testUser.email,
    password: testUser.password,
    totpSecret: testUser.totp,
    clientId,
    clientSecret,
    oneLoginEnvironment,
    authUrl,
    redirectUri: "http://localhost:3000",
  };

  return new TokenGenerator(config);
}

const getValidatedSecret = async <T>(
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

const getValidatedParameter = async (
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
