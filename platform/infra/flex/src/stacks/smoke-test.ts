import { Environment, getEnvConfig } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { ENV_KEYS, PLATFORM_KEYS } from "../ssm-keys";
import { applyCheckovSkips } from "../utils/applyCheckovSkip";
import { getPlatformSmokeTestEntry } from "../utils/getEntry";

const { env, stage } = getEnvConfig();

export class FlexSmokeTestStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region: "eu-west-2" },
    });

    const { criticalAction, warningAction } = importAlarmActions(this, {
      criticalTopicArn: this.import(ENV_KEYS.TopicCriticalAlarms),
      warningTopicArn: this.import(ENV_KEYS.TopicWarningAlarms),
    });

    const role = new Role(this, "SmokeTestRole", {
      roleName: `${env}-flex-smoke-test-role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole",
        ),
      ],
    });

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:aws:ssm:eu-west-2:${this.account}:parameter/${env}/flex/smoke-test/*`,
          `arn:aws:ssm:eu-west-2:${this.account}:parameter/${env}/flex-param/auth/*`,
          `arn:aws:ssm:eu-west-2:${this.account}:parameter${PLATFORM_KEYS.HostedZoneName}`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:eu-west-2:${this.account}:secret:/${env}/flex-secret/smoke-test/*`,
        ],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["kms:Decrypt"],
        resources: [`arn:aws:kms:eu-west-2:${this.account}:alias/aws/ssm`],
      }),
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
        conditions: {
          StringEquals: { "cloudwatch:namespace": "Flex/SmokeTest" },
        },
      }),
    );

    if (env === Environment.development) {
      // getStubTokenGenerator reads the e2e private JWK to self-sign tokens
      role.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["secretsmanager:GetSecretValue"],
          resources: [
            `arn:aws:secretsmanager:eu-west-2:${this.account}:secret:/${env}/flex-secret/auth/e2e/private_jwk*`,
          ],
        }),
      );
    }

    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateEgressSg = this.importSecurityGroup(ENV_KEYS.SgPrivateEgress);

    const smokeTest = new FlexPrivateEgressFunction(this, "SmokeTestFunction", {
      entry: getPlatformSmokeTestEntry("handler.ts"),
      timeout: Duration.minutes(2),
      role,
      vpc,
      privateEgressSg,
      criticalAction,
      warningAction,
      // The explicit SmokeTestAlarm below already covers this lambda's health
      disableDefaultAlarms: true,
    });

    applyCheckovSkips(smokeTest.function, [
      {
        id: "CKV_AWS_117",
        comment:
          "Smoke test Lambda intentionally in VPC for egress to external auth services",
      },
    ]);

    const rule = new Rule(this, "SmokeTestSchedule", {
      schedule: Schedule.rate(Duration.minutes(5)),
    });

    rule.addTarget(new LambdaFunction(smokeTest.function));

    new Alarm(this, "SmokeTestAlarm", {
      alarmName: `${stage}-smoke-test-no-success`,
      alarmDescription:
        "Smoke test has not reported a success in the last 15 minutes",
      metric: new Metric({
        namespace: "Flex/SmokeTest",
        metricName: "SmokeTestSuccess",
        dimensionsMap: { Environment: env },
        period: Duration.minutes(15),
        statistic: "Sum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.BREACHING,
      actionsEnabled: true,
    });
  }
}
