import {
  BaseTokenGenerator,
  e2eEnvSchema,
  flexStackOutputsSchema,
  getStubTokenGenerator,
  getTokenGenerator,
  invalidJwt,
} from "@flex/testing/e2e";
import { getStackOutputs, sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

config({ quiet: true });

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  const manualApiUrl = process.env.FLEX_API_URL;
  const manualGatewayUrl = process.env.FLEX_PRIVATE_GATEWAY_URL;
  const manualExecuteApiUrl = process.env.FLEX_PUBLIC_EXECUTE_API_URL;

  const envStage = sanitiseStageName(process.env.STAGE);

  let stage: string;
  let apiUrl: string;
  let privateGatewayUrl: string;
  let publicExecuteApiUrl: string;

  if (manualApiUrl || manualGatewayUrl || manualExecuteApiUrl) {
    if (
      !manualApiUrl ||
      !manualGatewayUrl ||
      !manualExecuteApiUrl ||
      envStage === undefined
    ) {
      throw new Error(
        "Manual Override Error: To provide a manual URL, you must provide FLEX_API_URL, FLEX_PRIVATE_GATEWAY_URL, FLEX_PUBLIC_EXECUTE_API_URL, and STAGE in your .env or command line.",
      );
    }

    stage = envStage;
    apiUrl = manualApiUrl;
    privateGatewayUrl = manualGatewayUrl;
    publicExecuteApiUrl = manualExecuteApiUrl;
  } else {
    stage = envStage ?? sanitiseStageName(process.env.USER) ?? "development";

    const platformOutputs = await getStackOutputs(`${stage}-FlexPlatform`);

    const platform = flexStackOutputsSchema.parse(platformOutputs);

    apiUrl = platform.FlexApiUrl;
    privateGatewayUrl = platform.PrivateGatewayUrl;
    publicExecuteApiUrl = platform.PublicApiExecuteUrl;
  }

  const jwtClient = await getJwtClient(stage);
  const validJwtToken = await jwtClient.getToken();

  provide(
    "e2eEnv",
    e2eEnvSchema.parse({
      FLEX_API_URL: apiUrl,
      FLEX_PRIVATE_GATEWAY_URL: privateGatewayUrl,
      FLEX_PUBLIC_EXECUTE_API_URL: publicExecuteApiUrl,
      STAGE: stage,
      JWT: {
        VALID: validJwtToken,
        INVALID: invalidJwt,
      },
    }),
  );
}

export async function getJwtClient(stage: string): Promise<BaseTokenGenerator> {
  if (stage === "staging" || stage === "production") {
    return await getTokenGenerator(stage);
  }
  return await getStubTokenGenerator();
}
