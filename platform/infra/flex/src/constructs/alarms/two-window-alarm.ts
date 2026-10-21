import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  AlarmRule,
  AlarmState,
  ComparisonOperator,
  CompositeAlarm,
  type IAlarmAction,
  type IMetric,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import type { Construct } from "constructs";

export interface TwoWindowAlarmProps {
  readonly id: string;
  readonly alarmName: string;
  readonly alarmDescription: string;
  /** Builds the rate metric for a given window so each child alarm gets a matching period. */
  readonly rateMetric: (period: Duration) => IMetric;
  readonly threshold: number;
  readonly longWindow: Duration;
  readonly shortWindow: Duration;
  readonly action: IAlarmAction;
}

function describeWindow(window: Duration) {
  const minutes = window.toMinutes();
  return minutes >= 60 ? `${String(minutes / 60)}h` : `${String(minutes)}m`;
}

/**
 * Multi window burn rate alarm: a composite that fires only when the same
 * rate breaches over both a long window (proving the problem is sustained)
 * and a short window (proving it is still happening). The child alarms carry
 * no actions, so a breach of one window alone is visible in CloudWatch but
 * does not notify anyone.
 */
export function createTwoWindowAlarm(
  scope: Construct,
  {
    id,
    alarmName,
    alarmDescription,
    rateMetric,
    threshold,
    longWindow,
    shortWindow,
    action,
  }: TwoWindowAlarmProps,
) {
  const windowAlarm = (window: Duration) =>
    new Alarm(scope, `${id}${describeWindow(window)}`, {
      alarmName: `${alarmName}-${describeWindow(window)}`,
      alarmDescription: `${describeWindow(window)} window of ${alarmName}. Notifies only through the composite alarm`,
      metric: rateMetric(window),
      threshold,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

  const longAlarm = windowAlarm(longWindow);
  const shortAlarm = windowAlarm(shortWindow);

  const composite = new CompositeAlarm(scope, id, {
    compositeAlarmName: alarmName,
    alarmDescription,
    alarmRule: AlarmRule.allOf(
      AlarmRule.fromAlarm(longAlarm, AlarmState.ALARM),
      AlarmRule.fromAlarm(shortAlarm, AlarmState.ALARM),
    ),
  });
  composite.addAlarmAction(action);

  return { composite, longAlarm, shortAlarm };
}
