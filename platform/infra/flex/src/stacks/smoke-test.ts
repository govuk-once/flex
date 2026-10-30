import { Environment, getEnvConfig } from "@flex/utils";
import {
  DIMENSIONS,
  METRIC_NAMESPACE,
  METRICS,
  probesForEnvironment,
} from "@platform/smoke-test/probes";
import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  Stats,
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
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { ENV_KEYS, PLATFORM_KEYS } from "../ssm-keys";
import { getPlatformSmokeTestEntry } from "../utils/getEntry";
import { putMetricDataStatement } from "../utils/put-metric-data-statement";
import { toPascalCase } from "../utils/routes";

const { env, stage } = getEnvConfig();

const PROBE_PERIOD = Duration.minutes(1);
const CONSECUTIVE_FAILURES = 3;
const RUNBOOK = "docs/runbooks/verify-environment-health.md";

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
          "service-role/AWSLambdaBasicExecutionRole",
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

    role.addToPolicy(putMetricDataStatement(METRIC_NAMESPACE));

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

    const smokeTest = new FlexPublicFunction(this, "SmokeTestFunction", {
      entry: getPlatformSmokeTestEntry("handler.ts"),
      timeout: Duration.minutes(2),
      role,
      criticalAction,
      warningAction,
      enableDefaultAlarms: false,
    });

    const rule = new Rule(this, "SmokeTestSchedule", {
      schedule: Schedule.rate(PROBE_PERIOD),
    });

    rule.addTarget(new LambdaFunction(smokeTest.function));

    probesForEnvironment(env).forEach(({ journey }) => {
      const alarm = new Alarm(this, `SmokeTest${toPascalCase(journey)}Alarm`, {
        alarmName: `${stage}-smoke-test-${journey}-no-success`,
        alarmDescription:
          `Critical: SERVICE UNAVAILABLE: the ${journey} smoke test has failed ${String(CONSECUTIVE_FAILURES)} times in a row ` +
          `(one run per minute). Catches an outage when traffic is too low for the journey alarms. Runbook: ${RUNBOOK}`,
        metric: new Metric({
          namespace: METRIC_NAMESPACE,
          metricName: METRICS.success,
          dimensionsMap: {
            [DIMENSIONS.environment]: env,
            [DIMENSIONS.journey]: journey,
          },
          period: PROBE_PERIOD,
          statistic: Stats.SUM,
        }),
        threshold: 1,
        evaluationPeriods: CONSECUTIVE_FAILURES,
        datapointsToAlarm: CONSECUTIVE_FAILURES,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.BREACHING,
      });
      alarm.addAlarmAction(criticalAction);
    });

    const authRejected = new Alarm(this, "SmokeTestAuthRejectedAlarm", {
      alarmName: `${stage}-smoke-test-auth-rejected`,
      alarmDescription:
        `Critical: AUTH FAILURE: the smoke test's valid token has been refused with a 401 or 403 ${String(CONSECUTIVE_FAILURES)} times in a row. ` +
        `Check Cognito, the JWKS endpoint and the authorizer logs. Runbook: ${RUNBOOK}`,
      metric: new Metric({
        namespace: METRIC_NAMESPACE,
        metricName: METRICS.authRejected,
        dimensionsMap: { [DIMENSIONS.environment]: env },
        period: PROBE_PERIOD,
        statistic: Stats.SUM,
      }),
      threshold: 0,
      evaluationPeriods: CONSECUTIVE_FAILURES,
      datapointsToAlarm: CONSECUTIVE_FAILURES,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    authRejected.addAlarmAction(criticalAction);
  }
}
