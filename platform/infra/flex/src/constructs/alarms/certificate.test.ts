import { Template } from "aws-cdk-lib/assertions";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { describe, expect, it } from "vitest";

import { createAlarmActions, createTestStack } from "../../test/alarm-actions";
import { CertificateAlarms } from "./certificate";

function synthesise() {
  const stack = createTestStack();
  const actions = createAlarmActions(stack);
  const certificate = new Certificate(stack, "Certificate", {
    domainName: "example.com",
  });

  new CertificateAlarms(stack, "CertificateAlarms", {
    alarmNamePrefix: "staging-certificate",
    certificate,
    criticalAction: actions.criticalAction,
    warningAction: actions.warningAction,
  });

  return {
    template: Template.fromStack(stack),
    certificateRef: stack.resolve(certificate.certificateArn) as unknown,
    ...actions,
  };
}

describe("CertificateAlarms", () => {
  it("creates a single alarm", () => {
    synthesise().template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
  });

  it("alarms below 30 days to expiry, past ACM's 45-day renewal point", () => {
    const { template, certificateRef, criticalActionRef } = synthesise();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "staging-certificate-days-to-expiry",
      Namespace: "AWS/CertificateManager",
      MetricName: "DaysToExpiry",
      Dimensions: [{ Name: "CertificateArn", Value: certificateRef }],
      Statistic: "Minimum",
      Period: 86400,
      Threshold: 30,
      EvaluationPeriods: 1,
      ComparisonOperator: "LessThanThreshold",
      AlarmActions: [criticalActionRef],
    });
  });

  it("keeps its state when ACM stops publishing after expiry", () => {
    synthesise().template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      TreatMissingData: "ignore",
    });
  });

  it("names the threshold in its description", () => {
    const alarms = synthesise().template.findResources(
      "AWS::CloudWatch::Alarm",
    );
    const [alarm] = Object.values(alarms) as {
      Properties: { AlarmDescription: string };
    }[];

    expect(alarm?.Properties.AlarmDescription).toContain("under 30 days");
  });
});
