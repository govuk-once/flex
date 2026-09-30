import { Environment, getEnvConfig } from "@flex/utils";
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

const { env } = getEnvConfig();

const MANUAL_ROTATION_CADENCE_DAYS = 90;

interface ManualRotationSecret {
  secretId: string;
  resourceArn: string;
}

export class FlexCredentialMonitorStack extends BaseStack {
  #secretByArn(secretArn: string): ManualRotationSecret {
    return { secretId: secretArn, resourceArn: secretArn };
  }

  #secretByName(secretName: string): ManualRotationSecret {
    return {
      secretId: secretName,
      resourceArn: `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${secretName}-??????`,
    };
  }

  #getManualRotationSecrets(): ManualRotationSecret[] {
    const testUserSecret =
      env === Environment.development
        ? this.#secretByName(`/${env}/flex-secret/auth/e2e/private_jwk`)
        : this.#secretByName(`/${env}/flex-secret/e2e/test_user`);

    return [
      this.#secretByArn(this.import(ENV_KEYS.UdpConfigSecretArn)),
      this.#secretByArn(this.import(ENV_KEYS.UnsConfigSecret)),
      this.#secretByName(`/${env}/flex-secret/smoke-test/user`),
      testUserSecret,
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
    const manualRotationSecrets = this.#getManualRotationSecrets();
    const cognitoParameters = this.#getCognitoParameters();

    const monitor = new FlexPublicFunction(this, "CredentialMonitorFunction", {
      entry: getPlatformEntry("credential-monitor", "handler.ts"),
      timeout: Duration.minutes(1),
      environment: {
        AUTHORIZER_FUNCTION_ARN: authorizerFunctionArn,
        MANUAL_ROTATION_SECRETS: this.toJsonString(
          manualRotationSecrets.map(({ secretId }) => ({
            secretId,
            cadenceDays: MANUAL_ROTATION_CADENCE_DAYS,
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
        resources: manualRotationSecrets.map(({ resourceArn }) => resourceArn),
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
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
        conditions: {
          StringEquals: { "cloudwatch:namespace": METRIC_NAMESPACE },
        },
      }),
    ].forEach((statement) => {
      monitor.function.addToRolePolicy(statement);
    });

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
