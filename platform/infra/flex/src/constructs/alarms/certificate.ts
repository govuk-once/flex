import { Duration } from "aws-cdk-lib";
import type { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  Alarm,
  ComparisonOperator,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

const DAYS_TO_EXPIRY_THRESHOLD = 30;

export interface CertificateAlarmsProps extends BaseAlarmsProps {
  readonly certificate: ICertificate;
}

export class CertificateAlarms extends Construct {
  public readonly daysToExpiryAlarm: Alarm;

  constructor(scope: Construct, id: string, props: CertificateAlarmsProps) {
    super(scope, id);

    const { certificate, criticalAction, alarmNamePrefix } = props;

    this.daysToExpiryAlarm = new Alarm(this, "DaysToExpiry", {
      alarmName: `${alarmNamePrefix}-days-to-expiry`,
      alarmDescription: `Critical: certificate expires in under ${String(DAYS_TO_EXPIRY_THRESHOLD)} days, past ACM's 45-day renewal point, check its renewal status and DNS validation records`,
      metric: certificate.metricDaysToExpiry({
        statistic: Stats.MINIMUM,
        period: Duration.days(1),
      }),
      threshold: DAYS_TO_EXPIRY_THRESHOLD,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
    });
    this.daysToExpiryAlarm.addAlarmAction(criticalAction);
  }
}
