import {
  Alarm,
  ComparisonOperator,
  type IAlarmAction,
  type IMetric,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import type { Construct } from "constructs";

export interface AboveZeroAlarmProps {
  readonly id: string;
  readonly alarmName: string;
  readonly alarmDescription: string;
  readonly metric: IMetric;
  readonly action: IAlarmAction;
}

export function createAboveZeroAlarm(
  scope: Construct,
  { id, alarmName, alarmDescription, metric, action }: AboveZeroAlarmProps,
) {
  const alarm = new Alarm(scope, id, {
    alarmName,
    alarmDescription,
    metric,
    threshold: 0,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });
  alarm.addAlarmAction(action);

  return alarm;
}
