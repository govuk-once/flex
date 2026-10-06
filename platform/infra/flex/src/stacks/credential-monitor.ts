import { getEnvConfig } from "@flex/utils";
import { METRIC_NAMESPACE } from "@platform/credential-monitor/metrics";
import { Duration } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { CredentialMonitorAlarms } from "../constructs/alarms/credential-monitor";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";
import { getAuthorizerParameterKeys } from "../utils/auth-parameters";
import { getPlatformEntry } from "../utils/getEntry";
import { resolveEncryptionKey } from "../utils/lambda";
import { putMetricDataStatement } from "../utils/put-metric-data-statement";

const { env } = getEnvConfig();

const DVLA_ROTATION_INTERVAL_DAYS = 60;

interface MaximumAgeSecret {
  secretId: string;
  resourceArn: string;
  maxAgeDays: number;
}

export class FlexCredentialMonitorStack extends BaseStack {
  #secretByArn(secretArn: string, maxAgeDays: number): MaximumAgeSecret {
    return { secretId: secretArn, resourceArn: secretArn, maxAgeDays };
  }

  // Only DVLA is checked: it is the only secret with an agreed rotation interval.
  // UDP is excluded: cross-account, ListSecretVersionIds would return AccessDenied.
  // UNS, smoke test user, and E2E test user are excluded until a rotation
  // policy and interval are agreed with the team.
  #getMaximumAgeSecrets(): MaximumAgeSecret[] {
    return [
      this.#secretByArn(
        this.import(ENV_KEYS.DvlaConfigSecretArn),
        DVLA_ROTATION_INTERVAL_DAYS,
      ),
    ];
  }

  #getCognitoParameters() {
    const { userPoolId, clientId } = getAuthorizerParameterKeys();

    return [
      { parameterName: userPoolId, environmentVariable: "USERPOOL_ID" },
      { parameterName: clientId, environmentVariable: "CLIENT_ID" },
    ];
  }

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

    const authorizerFunctionArn = this.import(
      STAGE_KEYS.ApigwPublicAuthorizerFn,
    );
    const maximumAgeSecrets = this.#getMaximumAgeSecrets();
    const cognitoParameters = this.#getCognitoParameters();

    const monitor = new FlexPublicFunction(this, "CredentialMonitorFunction", {
      entry: getPlatformEntry("credential-monitor", "handler.ts"),
      timeout: Duration.minutes(1),
      environment: {
        AUTHORIZER_FUNCTION_ARN: authorizerFunctionArn,
        MAXIMUM_ROTATION_INTERVAL_DAYS: String(DVLA_ROTATION_INTERVAL_DAYS),
        MAXIMUM_AGE_SECRETS: this.toJsonString(
          maximumAgeSecrets.map(({ secretId, maxAgeDays }) => ({
            secretId,
            maxAgeDays,
          })),
        ),
        COGNITO_PARAMETERS: this.toJsonString(cognitoParameters),
      },
      criticalAction,
      warningAction,
      enableDefaultAlarms: false,
    });

    [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["secretsmanager:ListSecrets"],
        resources: ["*"],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["secretsmanager:ListSecretVersionIds"],
        resources: maximumAgeSecrets.map(({ resourceArn }) => resourceArn),
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: cognitoParameters.map(
          ({ parameterName }) =>
            `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterName}`,
        ),
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:GetFunctionConfiguration"],
        resources: [authorizerFunctionArn],
      }),
      putMetricDataStatement(METRIC_NAMESPACE),
    ].forEach((statement) => {
      monitor.function.addToRolePolicy(statement);
    });

    resolveEncryptionKey(this).grantDecrypt(monitor.function);

    new Rule(this, "CredentialMonitorSchedule", {
      schedule: Schedule.rate(Duration.hours(1)),
      targets: [new LambdaFunction(monitor.function)],
    });

    new CredentialMonitorAlarms(this, "CredentialMonitorAlarms", {
      alarmNamePrefix: `${env}-credential-monitor`,
      environment: env,
      monitorFunction: monitor.function,
      criticalAction,
      warningAction,
    });
  }
}
