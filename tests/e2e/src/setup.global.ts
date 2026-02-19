import {
  e2eEnvSchema,
  flexPrivateGatewayStackOutputsSchema,
  flexStackOutputsSchema,
} from "@flex/testing/e2e";
import { getStackOutputs, sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

config({ quiet: true });

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  if (process.env.FLEX_API_URL && process.env.FLEX_PRIVATE_GATEWAY_URL) {
    provide("e2eEnv", e2eEnvSchema.parse(process.env));
    return;
  }

  const stage =
    sanitiseStageName(process.env.STAGE ?? process.env.USER) ?? "development";

  const baseEnv: Record<string, string> = { STAGE: stage };
  if (!process.env.FLEX_API_URL) {
    const platformOutputs = await getStackOutputs(`${stage}-FlexPlatform`);
    const { FlexApiUrl } = flexStackOutputsSchema.parse(platformOutputs);
    baseEnv.FLEX_API_URL = FlexApiUrl;
  }

  if (!process.env.FLEX_PRIVATE_GATEWAY_URL) {
    const privateGatewayOutputs = await getStackOutputs(
      `${stage}-FlexPrivateGateway`,
    );
    const { PrivateGatewayUrl } = flexPrivateGatewayStackOutputsSchema.parse(
      privateGatewayOutputs,
    );
    baseEnv.FLEX_PRIVATE_GATEWAY_URL = PrivateGatewayUrl;
  }

  provide("e2eEnv", e2eEnvSchema.parse({ ...process.env, ...baseEnv }));
}
