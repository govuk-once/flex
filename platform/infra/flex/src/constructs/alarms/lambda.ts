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

/** Windows with fewer invocations than this are too sparse for a percentile to mean anything. */
const MIN_INVOCATIONS = 10;

export interface LambdaAlarmsProps extends BaseAlarmsProps {
  readonly fn: Function;
}

export class LambdaAlarms extends Construct {
  public readonly errorRateAlarm: Alarm;
  public readonly throttlesAlarm: Alarm;
  public readonly durationAlarm: Alarm;

  constructor(scope: Construct, id: string, props: LambdaAlarmsProps) {
    super(scope, id);

    const { fn, warningAction, alarmNamePrefix } = props;

    this.errorRateAlarm = new Alarm(this, "ErrorRate", {
      alarmName: `${alarmNamePrefix}-error-rate`,
      alarmDescription:
        "Warning: errors in two consecutive 5 minute windows, at 10+ invocations. User impact is measured by the journey fast burn alarms",
      metric: new MathExpression({
        expression: `IF(invocations >= ${String(MIN_INVOCATIONS)}, 100 * (errors / invocations), 0)`,
        usingMetrics: {
          errors: fn.metricErrors({ period: Duration.minutes(5) }),
          invocations: fn.metricInvocations({ period: Duration.minutes(5) }),
        },
        period: Duration.minutes(5),
        label: "Error rate (%)",
      }),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.errorRateAlarm.addAlarmAction(warningAction);

    this.throttlesAlarm = new Alarm(this, "Throttles", {
      alarmName: `${alarmNamePrefix}-throttles`,
      alarmDescription:
        "Warning: function throttled in a 1 minute window. User impact is measured by the journey fast burn alarms",
      metric: fn.metricThrottles({
        period: Duration.minutes(1),
        statistic: Stats.SUM,
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.throttlesAlarm.addAlarmAction(warningAction);

    if (!fn.timeout) {
      throw new Error(
        `${alarmNamePrefix}: function must set an explicit timeout.`,
      );
    }
    const durationThreshold = Math.floor(fn.timeout.toMilliseconds() * 0.8);
    // At low traffic the p99 of a 5 minute window is often a single cold
    // invocation, so the rate is suppressed below a minimum invocation count
    // and must hold for two of three windows before it warns.
    this.durationAlarm = new Alarm(this, "Duration", {
      alarmName: `${alarmNamePrefix}-duration`,
      alarmDescription:
        `Warning: p99 duration above ${String(durationThreshold)}ms for 2 of 3 consecutive 5 minute windows, ` +
        `at ${String(MIN_INVOCATIONS)}+ invocations (suppressed below that so cold starts do not alarm)`,
      metric: new MathExpression({
        expression: `IF(invocations >= ${String(MIN_INVOCATIONS)}, duration, 0)`,
        usingMetrics: {
          duration: fn.metricDuration({
            period: Duration.minutes(5),
            statistic: Stats.p(99),
          }),
          invocations: fn.metricInvocations({ period: Duration.minutes(5) }),
        },
        period: Duration.minutes(5),
        label: `p99 duration (min ${String(MIN_INVOCATIONS)} invocations per period)`,
      }),
      threshold: durationThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.durationAlarm.addAlarmAction(warningAction);
  }
}
