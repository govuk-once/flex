import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export function putMetricDataStatement(namespace: string): PolicyStatement {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["cloudwatch:PutMetricData"],
    resources: ["*"],
    conditions: {
      StringEquals: { "cloudwatch:namespace": namespace },
    },
  });
}
