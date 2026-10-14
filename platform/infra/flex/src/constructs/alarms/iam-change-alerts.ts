import { getEnvConfig } from "@flex/utils";
import { Stack } from "aws-cdk-lib";
import type { IAlarmAction } from "aws-cdk-lib/aws-cloudwatch";
import { EventField } from "aws-cdk-lib/aws-events";
import type { Key } from "aws-cdk-lib/aws-kms";
import type { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

import { createDeploymentExclusion } from "./deployment-exclusion";
import { createEventAlert } from "./event-alert";

const { env } = getEnvConfig();

interface IamChangeAlertsProps {
  criticalTopic: Topic;
  alarmTopicKey: Key;
  warningAction: IAlarmAction;
}

export function createIamChangeAlerts(
  scope: Construct,
  { criticalTopic, alarmTopicKey, warningAction }: IamChangeAlertsProps,
) {
  const { region } = Stack.of(scope);
  const eventName = EventField.fromPath("$.detail.eventName");
  const actor = EventField.fromPath("$.detail.userIdentity.arn");
  const awsRegion = EventField.fromPath("$.detail.awsRegion");
  const sourceIPAddress = EventField.fromPath("$.detail.sourceIPAddress");
  const errorCode = EventField.fromPath("$.detail.errorCode");

  [
    {
      id: "IamChangeAlert",
      name: "iam-change-alert",
      title: "IAM change",
      alertDescription: "IAM change alert",
      service: "iam",
      regions: ["us-east-1"],
      events: [
        "CreateRole",
        "PutRolePolicy",
        "AttachRolePolicy",
        "CreatePolicyVersion",
        "SetDefaultPolicyVersion",
        "UpdateAssumeRolePolicy",
        "DeleteRolePermissionsBoundary",
        "PutRolePermissionsBoundary",
      ],
      resourceParameters: ["roleName", "policyArn"],
      exclusion: createDeploymentExclusion(scope, {
        role: "cfn-exec",
        regions: ["eu-west-2", "us-east-1"],
      }),
    },
    {
      id: "LambdaChangeAlert",
      name: "lambda-change-alert",
      title: "Lambda function change",
      alertDescription: "Lambda function change alert",
      service: "lambda",
      regions: ["eu-west-2", "us-east-1"],
      events: [
        "CreateFunction20150331",
        "UpdateFunctionConfiguration20150331v2",
        "UpdateFunctionCode20150331v2",
      ],
      resourceParameters: ["functionName"],
      exclusion: createDeploymentExclusion(scope, {
        role: "cfn-exec",
        regions: [region],
      }),
    },
    {
      id: "CloudFormationChangeAlert",
      name: "cloudformation-change-alert",
      title: "CloudFormation call",
      alertDescription: "CloudFormation call alert",
      service: "cloudformation",
      regions: ["eu-west-2", "us-east-1"],
      events: [
        "CreateStack",
        "UpdateStack",
        "CreateChangeSet",
        "ExecuteChangeSet",
      ],
      resourceParameters: ["stackName"],
      exclusion: createDeploymentExclusion(scope, {
        role: "deploy",
        regions: [region],
      }),
    },
  ]
    .filter(({ regions }) => regions.includes(region))
    .forEach((alert) => {
      const resources = alert.resourceParameters
        .map((parameter) => {
          const value = EventField.fromPath(
            `$.detail.requestParameters.${parameter}`,
          );
          return `${parameter}: \`${value}\``;
        })
        .join("; ");

      createEventAlert(scope, {
        id: alert.id,
        name: alert.name,
        ruleId: `${alert.id}Rule`,
        ruleDescription: `${alert.title} alerts with CDK bootstrap-role exclusions`,
        eventPattern: {
          source: [`aws.${alert.service}`],
          detailType: ["AWS API Call via CloudTrail"],
          detail: {
            eventSource: [`${alert.service}.amazonaws.com`],
            eventName: alert.events,
            ...alert.exclusion,
          },
        },
        alertDescription: alert.alertDescription,
        title: `${alert.title} in ${env}`,
        description: `Event: \`${eventName}\`; actor: \`${actor}\`; ${resources}; Region: \`${awsRegion}\`; source IP: \`${sourceIPAddress}\`; errorCode: \`${errorCode}\`. Runbook: docs/runbooks/iam-change-alert.md`,
        criticalTopic,
        alarmTopicKey,
        warningAction,
      });
    });
}
