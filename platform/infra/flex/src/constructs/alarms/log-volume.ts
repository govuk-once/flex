import { Duration, Stack } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

const BYTES_PER_GIBIBYTE = 1024 ** 3;
const INCOMING_GIBIBYTES_PER_PERIOD_THRESHOLD = 1;
const PERIOD = Duration.minutes(5);
const SUSTAINED_PERIODS = 3;

export class LogVolumeAlarms extends Construct {
  public readonly incomingBytesAlarm: Alarm;

  constructor(scope: Construct, id: string, props: BaseAlarmsProps) {
    super(scope, id);

    const { warningAction, alarmNamePrefix } = props;

    const threshold = `${String(INCOMING_GIBIBYTES_PER_PERIOD_THRESHOLD)} GiB`;
    const period = `${String(PERIOD.toMinutes())} minute`;
    const { region } = Stack.of(this);

    this.incomingBytesAlarm = new Alarm(this, "IncomingBytes", {
      alarmName: `${alarmNamePrefix}-incoming-bytes`,
      alarmDescription:
        `Warning: CloudWatch Logs in ${region} ingested more than ${threshold} per ${period} window across all log groups, ` +
        `for ${String(SUSTAINED_PERIODS)} consecutive windows. Look for a logging loop or a flood of requests: ` +
        "graph AWS/Logs IncomingBytes by LogGroupName to find the log group responsible",
      metric: new Metric({
        namespace: "AWS/Logs",
        metricName: "IncomingBytes",
        statistic: Stats.SUM,
        period: PERIOD,
      }),
      threshold: INCOMING_GIBIBYTES_PER_PERIOD_THRESHOLD * BYTES_PER_GIBIBYTE,
      evaluationPeriods: SUSTAINED_PERIODS,
      datapointsToAlarm: SUSTAINED_PERIODS,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.incomingBytesAlarm.addAlarmAction(warningAction);
  }
}
