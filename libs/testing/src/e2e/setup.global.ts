import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getStackOutputs, sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

import { e2eEnvSchema } from "../config/env";
import { invalidJwt } from "../fixtures/auth";
import { getStubTokenGenerator } from "../fixtures/StubTokenGenerator";
import {
  type BaseTokenGenerator,
  getTokenGenerator,
} from "../fixtures/TokenGenerator";

config({ quiet: true });

async function getE2eBypassToken(stage: string): Promise<string> {
  const token = await getSecret(`/${stage}/flex-secret/e2e-bypass`);

  if (!token) {
    throw new Error(`E2E bypass secret not found for stage "${stage}"`);
  }

  return token as string;
}

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  const manualApiUrl = process.env.FLEX_API_URL;
  const manualGatewayUrl = process.env.FLEX_PRIVATE_GATEWAY_URL;

  const envStage = sanitiseStageName(process.env.STAGE);

  let stage: string;
  let apiUrl: string;
  let privateGatewayUrl: string;

  if (manualApiUrl || manualGatewayUrl) {
    if (!manualApiUrl || !manualGatewayUrl || envStage === undefined) {
      throw new Error(
        "Manual Override Error: To provide a manual URL, you must provide FLEX_API_URL, FLEX_PRIVATE_GATEWAY_URL, and STAGE in your .env or command line.",
      );
    }

    stage = envStage;
    apiUrl = manualApiUrl;
    privateGatewayUrl = manualGatewayUrl;
  } else {
    stage = envStage ?? sanitiseStageName(process.env.USER) ?? "development";

    const [{ PrivateGatewayUrl }, { FlexApiUrl }] = await Promise.all([
      getStackOutputs(`${stage}-FlexPlatform`),
      getStackOutputs(`${stage}-FlexGlobal`, "us-east-1"),
    ]);

    if (!PrivateGatewayUrl) {
      throw new Error(
        "PrivateGatewayUrl missing from FlexPlatform stack CloudFormation outputs",
      );
    }
    if (!FlexApiUrl) {
      throw new Error(
        "FlexApiUrl missing from FlexGlobal stack CloudFormation outputs",
      );
    }

    apiUrl = FlexApiUrl;
    privateGatewayUrl = PrivateGatewayUrl;
  }

  const [validJwtToken, e2eBypassToken] = await Promise.all([
    getJwtClient(stage).then((c) => c.getToken()),
    getE2eBypassToken(stage),
  ]);

  provide(
    "e2eEnv",
    e2eEnvSchema.parse({
      FLEX_API_URL: apiUrl,
      FLEX_PRIVATE_GATEWAY_URL: privateGatewayUrl,
      STAGE: stage,
      JWT: {
        VALID: validJwtToken,
        INVALID: invalidJwt,
      },
      E2E_BYPASS_TOKEN: e2eBypassToken,
    }),
  );
}

export async function getJwtClient(stage: string): Promise<BaseTokenGenerator> {
  if (stage === "staging" || stage === "production") {
    return await getTokenGenerator(stage);
  }
  return await getStubTokenGenerator();
}
