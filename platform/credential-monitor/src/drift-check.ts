import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient();
const lambda = new LambdaClient();
const cloudWatch = new CloudWatchClient();
const sns = new SNSClient();

async function getSSMValue(name: string): Promise<string | undefined> {
  try {
    const result = await ssm.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    return result.Parameter?.Value;
  } catch {
    return undefined;
  }
}

interface DriftResult {
  parameter: string;
  envVar: string;
  ssmValue: string | undefined;
  deployedValue: string | undefined;
}

export const handler = async (): Promise<void> => {
  const env = process.env.FLEX_ENVIRONMENT!;
  const authorizerFunctionName = process.env.AUTHORIZER_FUNCTION_NAME!;
  const snsTopicArn = process.env.SNS_CRITICAL_TOPIC_ARN!;

  const fnConfig = await lambda.send(
    new GetFunctionConfigurationCommand({
      FunctionName: authorizerFunctionName,
    }),
  );
  const deployedEnv = fnConfig.Environment?.Variables ?? {};

  const checks: { ssmPath: string; envVar: string; label: string }[] = [
    {
      ssmPath: `/${env}/flex-param/auth/user-pool-id`,
      envVar: "USERPOOL_ID",
      label: "User Pool ID",
    },
    {
      ssmPath: `/${env}/flex-param/auth/client-id`,
      envVar: "CLIENT_ID",
      label: "Client ID",
    },
  ];

  if (env === "development") {
    checks.push(
      {
        ssmPath: `/${env}/flex-param/auth/stub/user-pool-id`,
        envVar: "USERPOOL_ID",
        label: "Stub User Pool ID",
      },
      {
        ssmPath: `/${env}/flex-param/auth/stub/client-id`,
        envVar: "CLIENT_ID",
        label: "Stub Client ID",
      },
    );
  }

  const drifts: DriftResult[] = [];

  for (const check of checks) {
    const ssmValue = await getSSMValue(check.ssmPath);
    const deployedValue = deployedEnv[check.envVar];

    if (ssmValue && deployedValue && ssmValue !== deployedValue) {
      drifts.push({
        parameter: check.ssmPath,
        envVar: check.envVar,
        ssmValue,
        deployedValue,
      });
    }
  }

  const hasDrift = drifts.length > 0 ? 1 : 0;

  await cloudWatch.send(
    new PutMetricDataCommand({
      Namespace: "Flex/Credentials",
      MetricData: [
        {
          MetricName: "CognitoDrift",
          Value: hasDrift,
          Unit: "Count",
          Dimensions: [{ Name: "Environment", Value: env }],
        },
      ],
    }),
  );

  if (drifts.length > 0) {
    await sns.send(
      new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: `[${env}] Cognito config drift detected`,
        Message: [
          "Cognito configuration in SSM does not match the deployed authorizer Lambda.",
          "A deployment is required to activate the updated configuration.",
          "",
          ...drifts.map(
            (d) => `  • ${d.parameter} (${d.envVar}): SSM and deployed values differ`,
          ),
        ].join("\n"),
      }),
    );
  }
};
