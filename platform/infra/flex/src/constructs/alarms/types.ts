import { IAlarmAction } from "aws-cdk-lib/aws-cloudwatch";

export interface AlarmActionProps {
  readonly criticalAction: IAlarmAction;
  readonly warningAction: IAlarmAction;
  readonly criticalAlarmNameSuffix?: string;
}

export interface BaseAlarmsProps extends AlarmActionProps {
  readonly alarmNamePrefix: string;
}
