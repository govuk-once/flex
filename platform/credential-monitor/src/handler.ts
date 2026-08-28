import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  DescribeSecretCommand,
  ListSecretsCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const secretsManager = new SecretsManagerClient();
const cloudWatch = new CloudWatchClient();
const sns = new SNSClient();

const CADENCE_DAYS: Record<string, number> = {
  infrastructure: 30,
  external: 90,
  test: 90,
};

function classifySecret(name: string): string {
  if (name.includes("origin-verify") || name.includes("waf/e2e-bypass")) {
    return "infrastructure";
  }
  if (
    name.includes("consumer-config") ||
    name.includes("dvla") ||
    name.includes("udp") ||
    name.includes("uns")
  ) {
    return "external";
  }
  return "test";
}

function isOverdue(lastRotated: Date | undefined, cadenceDays: number): boolean {
  if (!lastRotated) return true;
  const ageMs = Date.now() - lastRotated.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > cadenceDays;
}

export const handler = async (): Promise<void> => {
  const env = process.env.FLEX_ENVIRONMENT!;
  const snsTopicArn = process.env.SNS_WARNING_TOPIC_ARN!;

  const secrets = await secretsManager.send(
    new ListSecretsCommand({
      Filters: [{ Key: "name", Values: [`/${env}/flex-secret`] }],
    }),
  );

  const overdueSecrets: string[] = [];

  for (const secret of secrets.SecretList ?? []) {
    if (!secret.ARN || !secret.Name) continue;

    const detail = await secretsManager.send(
      new DescribeSecretCommand({ SecretId: secret.ARN }),
    );

    const category = classifySecret(secret.Name);
    const cadence = CADENCE_DAYS[category] ?? 90;
    const lastRotated = detail.LastRotatedDate ?? detail.CreatedDate;

    if (isOverdue(lastRotated, cadence)) {
      overdueSecrets.push(
        `${secret.Name} (${category}, ${cadence}d cadence, last rotated: ${lastRotated?.toISOString() ?? "never"})`,
      );
    }
  }

  const isOverdueMetric = overdueSecrets.length > 0 ? 1 : 0;

  await cloudWatch.send(
    new PutMetricDataCommand({
      Namespace: "Flex/Credentials",
      MetricData: [
        {
          MetricName: "SecretOverdue",
          Value: isOverdueMetric,
          Unit: "Count",
          Dimensions: [{ Name: "Environment", Value: env }],
        },
      ],
    }),
  );

  if (overdueSecrets.length > 0) {
    await sns.send(
      new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: `[${env}] Overdue secret rotation detected`,
        Message: [
          `${overdueSecrets.length} secret(s) are overdue for rotation:`,
          "",
          ...overdueSecrets.map((s) => `  • ${s}`),
          "",
          "Refer to the credential rotation inventory for rotation procedures.",
        ].join("\n"),
      }),
    );
  }
};
