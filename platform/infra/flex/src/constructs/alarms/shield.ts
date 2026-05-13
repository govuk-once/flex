import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface ShieldAlarmsProps extends BaseAlarmsProps {
  readonly resourceArn: string;
}

export class ShieldAlarms extends Construct {
  public readonly ddosDetectedAlarm: Alarm;
  public readonly ddosAttackRequestsPerSecondAlarm: Alarm;

  constructor(scope: Construct, id: string, props: ShieldAlarmsProps) {
    super(scope, id);

    const { resourceArn, criticalAction, warningAction, alarmNamePrefix } =
      props;

    const dimensions = { ResourceArn: resourceArn };

    this.ddosDetectedAlarm = new Alarm(this, "DDoSDetected", {
      alarmName: `${alarmNamePrefix}-ddos-detected`,
      alarmDescription:
        "Critical: Shield Advanced has detected a DDoS attack against the CloudFront distribution",
      metric: new Metric({
        namespace: "AWS/DDoSProtection",
        metricName: "DDoSDetected",
        dimensionsMap: dimensions,
        statistic: Stats.MAXIMUM,
        period: Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.ddosDetectedAlarm.addAlarmAction(criticalAction);

    this.ddosAttackRequestsPerSecondAlarm = new Alarm(
      this,
      "DDoSAttackRequestsPerSecond",
      {
        alarmName: `${alarmNamePrefix}-ddos-attack-requests-per-second`,
        alarmDescription:
          "Warning: Shield Advanced is reporting DDoS attack request volume against the CloudFront distribution",
        metric: new Metric({
          namespace: "AWS/DDoSProtection",
          metricName: "DDoSAttackRequestsPerSecond",
          dimensionsMap: dimensions,
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
