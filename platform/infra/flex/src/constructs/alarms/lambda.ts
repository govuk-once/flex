import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  MathExpression,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface LambdaAlarmsProps extends BaseAlarmsProps {
  readonly fn: Function;
}

export class LambdaAlarms extends Construct {
  public readonly errorRateAlarm: Alarm;
  public readonly throttlesAlarm: Alarm;
  public readonly durationAlarm: Alarm;

  constructor(scope: Construct, id: string, props: LambdaAlarmsProps) {
    super(scope, id);

    const { fn, criticalAction, warningAction, alarmNamePrefix } = props;

    this.errorRateAlarm = new Alarm(this, "ErrorRate", {
      alarmName: `${alarmNamePrefix}-error-rate`,
      alarmDescription: "Critical: error rate above 1% over 5 minutes",
      metric: new MathExpression({
        expression: "IF(invocations > 0, 100 * (errors / invocations), 0)",
        usingMetrics: {
          errors: fn.metricErrors({ period: Duration.minutes(5) }),
          invocations: fn.metricInvocations({ period: Duration.minutes(5) }),
        },
        period: Duration.minutes(5),
        label: "Error rate (%)",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.errorRateAlarm.addAlarmAction(criticalAction);

    this.throttlesAlarm = new Alarm(this, "Throttles", {
      alarmName: `${alarmNamePrefix}-throttles`,
      alarmDescription: "Warning: function throttled for 5 consecutive minutes",
      metric: fn.metricThrottles({
        period: Duration.minutes(1),
        statistic: Stats.SUM,
      }),
      threshold: 0,
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.throttlesAlarm.addAlarmAction(warningAction);

    const timeoutMs = fn.timeout?.toMilliseconds();
    const durationThreshold = timeoutMs ? Math.floor(timeoutMs * 0.8) : 24000;
    this.durationAlarm = new Alarm(this, "Duration", {
      alarmName: `${alarmNamePrefix}-duration`,
      alarmDescription: `Warning: p99 duration above ${String(durationThreshold)}ms over 5 minutes`,
      metric: fn.metricDuration({
        period: Duration.minutes(5),
        statistic: Stats.p(99),
      }),
      threshold: durationThreshold,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.durationAlarm.addAlarmAction(warningAction);
  }
}
