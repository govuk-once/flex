import { Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import {
  Code,
  Function as LambdaFunction,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { describe, expect, it } from "vitest";

import { CRITICAL_ALARM_ANNOTATION } from "../constructs/alarms/alarm-annotations";
import { AuthFailureAlarms } from "../constructs/alarms/auth-failure";
import { CertificateAlarms } from "../constructs/alarms/certificate";
import { CloudFrontAlarms } from "../constructs/alarms/cloudfront";
import { CredentialMonitorAlarms } from "../constructs/alarms/credential-monitor";
import { JourneyAlarms } from "../constructs/alarms/journeys";
import { SecretRotationAlarms } from "../constructs/alarms/secret-rotation";
import { ShieldAlarms } from "../constructs/alarms/shield";
import { WafAlarms } from "../constructs/alarms/waf";
import { createAlarmActions, createTestStack } from "./alarm-actions";

function synthesiseAllAlarmTypes(criticalAlarmNameSuffix?: string) {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);

  const fn = new LambdaFunction(stack, "TestFunction", {
    runtime: Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: Code.fromInline("exports.handler = async () => {};"),
    timeout: Duration.seconds(20),
  });
  const logGroup = new LogGroup(stack, "AccessLogs");

  const alarmProps = { ...actions, criticalAlarmNameSuffix };

  new CertificateAlarms(stack, "CertAlarms", {
    alarmNamePrefix: "test-cert",
    certificate: new Certificate(stack, "Cert", { domainName: "example.com" }),
    ...alarmProps,
  });

  new SecretRotationAlarms(stack, "RotAlarms", {
    alarmNamePrefix: "test-rotation",
    fn,
    ...alarmProps,
  });

  new CredentialMonitorAlarms(stack, "CredAlarms", {
    alarmNamePrefix: "test-cred-monitor",
    environment: "test",
    monitorFunction: fn,
    ...alarmProps,
  });

  new ShieldAlarms(stack, "ShieldAlarms", {
    alarmNamePrefix: "test-shield",
    resourceArn: `arn:aws:cloudfront::${Stack.of(stack).account}:distribution/E123`,
    ...alarmProps,
  });

  new WafAlarms(stack, "WafAlarms", {
    alarmNamePrefix: "test-waf",
    webAclScope: "REGIONAL",
    webAclMetricName: "TestAcl",
    managedRuleMetricNames: ["ALL"],
    ...alarmProps,
  });

  new CloudFrontAlarms(stack, "CfAlarms", {
    alarmNamePrefix: "test-cloudfront",
    distribution: Distribution.fromDistributionAttributes(
      stack,
      "TestDistribution",
      {
        distributionId: "E123",
        domainName: "d123.cloudfront.net",
      },
    ),
    trafficCliff: true,
    ...alarmProps,
  });

  new AuthFailureAlarms(stack, "AuthAlarms", {
    alarmNamePrefix: "test-apigw",
    accessLogGroup: logGroup,
    ...alarmProps,
  });

  new JourneyAlarms(stack, "JourneyAlarms", {
    alarmNamePrefix: "test-journey",
    accessLogGroup: logGroup,
    ...alarmProps,
  });

  return { template: Template.fromStack(stack), ...actions };
}

describe("Critical alarm annotation enforcement", () => {
  it("in production, every alarm with the critical action carries the channel annotation", () => {
    const { template, criticalActionRef } = synthesiseAllAlarmTypes(
      CRITICAL_ALARM_ANNOTATION,
    );

    const alarms = template.findResources("AWS::CloudWatch::Alarm");
    const composites = template.findResources(
      "AWS::CloudWatch::CompositeAlarm",
    );

    const missing: string[] = [];

    for (const [id, resource] of Object.entries(alarms) as [
      string,
      { Properties: { AlarmName?: string; AlarmActions?: unknown[] } },
    ][]) {
      const actions = resource.Properties.AlarmActions ?? [];
      const isCritical = actions.some(
        (a) => JSON.stringify(a) === JSON.stringify(criticalActionRef),
      );
      if (isCritical) {
        const name = resource.Properties.AlarmName ?? id;
        if (!String(name).includes(CRITICAL_ALARM_ANNOTATION)) {
          missing.push(String(name));
        }
      }
    }

    for (const [id, resource] of Object.entries(composites) as [
      string,
      {
        Properties: {
          AlarmName?: string;
          CompositeAlarmName?: string;
          AlarmActions?: unknown[];
        };
      },
    ][]) {
      const actions = resource.Properties.AlarmActions ?? [];
      const isCritical = actions.some(
        (a) => JSON.stringify(a) === JSON.stringify(criticalActionRef),
      );
      if (isCritical) {
        const name =
          resource.Properties.AlarmName ??
          resource.Properties.CompositeAlarmName ??
          id;
        if (!String(name).includes(CRITICAL_ALARM_ANNOTATION)) {
          missing.push(String(name));
        }
      }
    }

    expect(
      missing,
      `Critical alarms missing ${CRITICAL_ALARM_ANNOTATION}: ${missing.join(", ")}`,
    ).toHaveLength(0);
  });

  it("outside production, no alarm carries the annotation", () => {
    const { template } = synthesiseAllAlarmTypes();

    const alarms = template.findResources("AWS::CloudWatch::Alarm");
    const composites = template.findResources(
      "AWS::CloudWatch::CompositeAlarm",
    );

    const wronglyAnnotated: string[] = [];

    for (const [id, resource] of Object.entries({
      ...alarms,
      ...composites,
    }) as [
      string,
      {
        Properties: {
          AlarmName?: string;
          CompositeAlarmName?: string;
        };
      },
    ][]) {
      const name =
        resource.Properties.AlarmName ??
        resource.Properties.CompositeAlarmName ??
        id;
      if (String(name).includes(CRITICAL_ALARM_ANNOTATION)) {
        wronglyAnnotated.push(String(name));
      }
    }

    expect(
      wronglyAnnotated,
      `Non-production alarms carrying ${CRITICAL_ALARM_ANNOTATION}: ${wronglyAnnotated.join(", ")}`,
    ).toHaveLength(0);
  });
});
