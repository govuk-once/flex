import {
  e2eEnvSchema,
  flexStackOutputsSchema,
  getTokenProvider,
} from "@flex/testing/e2e";
import { getStackOutputs, sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

config({ quiet: true });

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  const stage =
    sanitiseStageName(process.env.STAGE ?? process.env.USER) ?? "development";
  const stack = `${stage}-FlexPlatform`;
  const outputs = await getStackOutputs(stack);

  const tokenClient = await getTokenProvider();

  const { FlexApiUrl } = flexStackOutputsSchema.parse(outputs);
  provide(
    "e2eEnv",
    e2eEnvSchema.parse({
      FLEX_API_URL: FlexApiUrl,
      VALID_JWT: await tokenClient.getToken(),
      INVALID_JWT: "invalid.jwt.token",
      EXPIRED_JWT: await tokenClient.getToken({ exp: "-1h" }),
      MISSING_USER_NAME_JWT: await tokenClient.getToken({
        includeUsername: false,
      }),
      STAGE: stage,
    }),
  );
}
