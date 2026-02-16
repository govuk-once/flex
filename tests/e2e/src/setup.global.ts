import { e2eEnvSchema, flexStackOutputsSchema } from "@flex/testing/e2e";
import { getStackOutputs, sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

config({ quiet: true });

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  if (process.env.FLEX_API_URL) {
    provide("e2eEnv", e2eEnvSchema.parse(process.env));
    return;
  }

  const stage =
    sanitiseStageName(process.env.STAGE ?? process.env.USER) ?? "development";
  const stack = `${stage}-FlexPlatform`;
  const outputs = await getStackOutputs(stack);

  const { FlexApiUrl } = flexStackOutputsSchema.parse(outputs);

  provide(
    "e2eEnv",
    e2eEnvSchema.parse({
      FLEX_API_URL: FlexApiUrl,
      STAGE: stage,
    }),
  );
}
