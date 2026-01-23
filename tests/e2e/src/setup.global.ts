import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import { e2eEnvSchema, flexStackOutputsSchema } from "@flex/testing/e2e";
import { sanitiseStageName } from "@flex/utils";
import { config } from "dotenv";

config({ quiet: true });

const client = new CloudFormationClient();

async function fetchStackOutputs(stackName: string) {
  const { Stacks } = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );

  if (!Stacks?.[0]?.Outputs) {
    throw new Error(`Stack "${stackName}" not found or has no outputs`);
  }

  return Object.fromEntries(
    Stacks[0].Outputs.map((o) => [o.OutputKey ?? "", o.OutputValue ?? ""]),
  );
}

export default async function setup({
  provide,
}: {
  provide: (key: "e2eEnv", value: unknown) => void;
}) {
  if (process.env.API_GATEWAY_URL && process.env.CLOUDFRONT_DISTRIBUTION_URL) {
    provide("e2eEnv", e2eEnvSchema.parse(process.env));
    return;
  }

  const stage =
    sanitiseStageName(process.env.STAGE ?? process.env.USER) ?? "development";

  const { CloudfrontDistributionUrl, HttpApiUrl } =
    flexStackOutputsSchema.parse(
      await fetchStackOutputs(`${stage}-FlexPlatform`),
    );

  provide(
    "e2eEnv",
    e2eEnvSchema.parse({
      API_GATEWAY_URL: HttpApiUrl,
      CLOUDFRONT_DISTRIBUTION_URL: CloudfrontDistributionUrl,
      STAGE: stage,
    }),
  );
}
