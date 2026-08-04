import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  IAlarmAction,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface ShieldAlarmsProps extends BaseAlarmsProps {
  readonly resourceArn: string;
}

export interface ShieldEipAlarmsProps extends Omit<
  BaseAlarmsProps,
  "warningAction"
> {
  readonly resourceArns: string[];
}

interface DdosDetectedAlarmOptions {
  readonly alarmName: string;
  readonly alarmDescription: string;
  readonly resourceArn: string;
  readonly action: IAlarmAction;
}

function createDdosDetectedAlarm(
  scope: Construct,
  id: string,
  {
    alarmName,
    alarmDescription,
    resourceArn,
    action,
  }: DdosDetectedAlarmOptions,
) {
  const alarm = new Alarm(scope, id, {
    alarmName,
    alarmDescription,
    metric: new Metric({
      namespace: "AWS/DDoSProtection",
      metricName: "DDoSDetected",
      dimensionsMap: { ResourceArn: resourceArn },
      statistic: Stats.MAXIMUM,
      period: Duration.minutes(1),
    }),
    threshold: 0,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });
  alarm.addAlarmAction(action);
  return alarm;
}

export class ShieldAlarms extends Construct {
  public readonly ddosDetectedAlarm: Alarm;
  public readonly ddosAttackRequestsPerSecondAlarm: Alarm;

  constructor(scope: Construct, id: string, props: ShieldAlarmsProps) {
    super(scope, id);

    const { resourceArn, criticalAction, warningAction, alarmNamePrefix } =
      props;

    this.ddosDetectedAlarm = createDdosDetectedAlarm(this, "DDoSDetected", {
      alarmName: `${alarmNamePrefix}-ddos-detected`,
      alarmDescription:
        "Critical: Shield Advanced has detected a DDoS attack against the CloudFront distribution",
      resourceArn,
      action: criticalAction,
    });

    this.ddosAttackRequestsPerSecondAlarm = new Alarm(
      this,
      "DDoSAttackRequestsPerSecond",
      {
        alarmName: `${alarmNamePrefix}-ddos-attack-requests-per-second`,
        alarmDescription:
          "Warning: Shield Advanced is reporting layer 7 attack request volume against the CloudFront distribution",
        metric: new Metric({
          namespace: "AWS/DDoSProtection",
          metricName: "DDoSAttackRequestsPerSecond",
          dimensionsMap: { ResourceArn: resourceArn },
          statistic: Stats.MAXIMUM,
          period: Duration.minutes(1),
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.ddosAttackRequestsPerSecondAlarm.addAlarmAction(warningAction);
  }
}

export class ShieldEipAlarms extends Construct {
  public readonly ddosDetectedAlarms: Alarm[];

  constructor(scope: Construct, id: string, props: ShieldEipAlarmsProps) {
    super(scope, id);

    const { resourceArns, criticalAction, alarmNamePrefix } = props;

    this.ddosDetectedAlarms = resourceArns.map((resourceArn, index) =>
      createDdosDetectedAlarm(this, `DDoSDetectedNatEip${String(index + 1)}`, {
        alarmName: `${alarmNamePrefix}-nat-eip-${String(index + 1)}-ddos-detected`,
        alarmDescription:
          "Critical: Shield Advanced has detected a DDoS attack against a NAT gateway elastic IP",
        resourceArn,
        action: criticalAction,
      }),
    );
  }
}
