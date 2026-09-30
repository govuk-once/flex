import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface SecretRotationAlarmsProps extends BaseAlarmsProps {
  readonly fn: IFunction;
}

export class SecretRotationAlarms extends Construct {
  public readonly failedAlarm: Alarm;

  constructor(scope: Construct, id: string, props: SecretRotationAlarmsProps) {
    super(scope, id);

    const { fn, criticalAction, alarmNamePrefix } = props;

    this.failedAlarm = new Alarm(this, "Failed", {
      alarmName: `${alarmNamePrefix}-failed`,
      alarmDescription:
        "Critical: the secret rotation Lambda failed, so the secret has not rotated. Check the Lambda logs and the secret's rotation status",
      metric: fn.metricErrors({
        statistic: Stats.SUM,
        period: Duration.minutes(5),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.failedAlarm.addAlarmAction(criticalAction);
  }
}
