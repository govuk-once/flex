import { Duration, Stack } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface WafAlarmsProps extends BaseAlarmsProps {
  readonly webAclName: string;
}

export class WafAlarms extends Construct {
  public readonly blockingAllRequestsAlarm: Alarm;
  public readonly blockedRequestsSpikeAlarm: Alarm;

  constructor(scope: Construct, id: string, props: WafAlarmsProps) {
    super(scope, id);

    const { webAclName, criticalAction, warningAction, alarmNamePrefix } =
      props;

    const dimensions = {
      WebACL: webAclName,
      Rule: "ALL",
      Region: Stack.of(this).region,
    };

    const blocked5m = new Metric({
      namespace: "AWS/WAFV2",
      metricName: "BlockedRequests",
      dimensionsMap: dimensions,
      statistic: Stats.SUM,
      period: Duration.minutes(5),
    });

    this.blockingAllRequestsAlarm = new Alarm(this, "BlockingAllRequests", {
      alarmName: `${alarmNamePrefix}-blocking-all-requests`,
      alarmDescription:
        "Critical: WAF blocking >90% of total requests over 5 minutes",
      metric: new MathExpression({
        expression:
          "IF((blocked + allowed) > 0, 100 * (blocked / (blocked + allowed)), 0)",
        usingMetrics: {
          blocked: blocked5m,
          allowed: new Metric({
            namespace: "AWS/WAFV2",
            metricName: "AllowedRequests",
            dimensionsMap: dimensions,
            statistic: Stats.SUM,
            period: Duration.minutes(5),
          }),
        },
        period: Duration.minutes(5),
        label: "Block rate (%)",
      }),
      threshold: 90,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.blockingAllRequestsAlarm.addAlarmAction(criticalAction);

    this.blockedRequestsSpikeAlarm = new Alarm(this, "BlockedRequestsSpike", {
      alarmName: `${alarmNamePrefix}-blocked-requests-spike`,
      alarmDescription:
        "Warning: blocked requests over 5 minutes exceeded 3x the trailing 1-hour average",
      metric: new MathExpression({
        expression: "IF(baseline > 0, recent / baseline, 0)",
        usingMetrics: {
          recent: blocked5m,
          baseline: new Metric({
            namespace: "AWS/WAFV2",
            metricName: "BlockedRequests",
            dimensionsMap: dimensions,
            statistic: Stats.AVERAGE,
            period: Duration.hours(1),
          }),
        },
        period: Duration.minutes(5),
        label: "Spike ratio",
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.blockedRequestsSpikeAlarm.addAlarmAction(warningAction);
  }
}
