import { Duration, Stack } from "aws-cdk-lib";
import {
  Alarm,
  AnomalyDetectionAlarm,
  ComparisonOperator,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface WafAlarmsProps extends BaseAlarmsProps {
  readonly webAclScope: "CLOUDFRONT" | "REGIONAL";
  readonly webAclMetricName: string;
  readonly managedRuleMetricNames: string[];
}

export class WafAlarms extends Construct {
  public readonly blockingAllRequestsAlarm: Alarm;
  public readonly blockedRequestsSpikeAlarm: AnomalyDetectionAlarm;
  public readonly managedRuleBlocksAlarm: Alarm;

  constructor(scope: Construct, id: string, props: WafAlarmsProps) {
    super(scope, id);

    const {
      criticalAction,
      warningAction,
      alarmNamePrefix,
      webAclMetricName,
      webAclScope,
    } = props;

    const wafMetric = (metricName: string, rule: string) => {
      return new Metric({
        namespace: "AWS/WAFV2",
        metricName,
        dimensionsMap: {
          Rule: rule,
          WebACL: webAclMetricName,
          // CLOUDFRONT web ACLs publish metrics without a Region dimension.
          ...(webAclScope === "REGIONAL" && {
            Region: Stack.of(this).region,
          }),
        },
        statistic: Stats.SUM,
        period: Duration.minutes(5),
      });
    };

    const blocked = wafMetric("BlockedRequests", "ALL");
    const allowed = wafMetric("AllowedRequests", "ALL");

    const managedBlocks = Object.fromEntries(
      props.managedRuleMetricNames.map((name, i) => [
        `m${String(i)}`,
        wafMetric("BlockedRequests", name),
      ]),
    );

    this.managedRuleBlocksAlarm = new Alarm(this, "ManagedRuleBlocks", {
      alarmName: `${alarmNamePrefix}-managed-rules-blocked-requests`,
      alarmDescription:
        "Critical: AWS managed rules blocking requests (known-bad inputs)",
      metric: new MathExpression({
        expression: Object.keys(managedBlocks)
          .map((id) => `FILL(${id}, 0)`)
          .join(" + "),
        usingMetrics: managedBlocks,
        label: "Managed rule blocks",
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.managedRuleBlocksAlarm.addAlarmAction(criticalAction);

    this.blockingAllRequestsAlarm = new Alarm(
      this,
      "Blocking90PercentRequests",
      {
        alarmName: `${alarmNamePrefix}-blocking-90-percent-requests`,
        alarmDescription:
          "Critical: WAF blocking >90% of total requests over 5 minutes",
        metric: new MathExpression({
          expression:
            "IF((blocked + allowed) > 0, 100 * (blocked / (blocked + allowed)), 0)",
          usingMetrics: { blocked, allowed },
          label: "Block rate (%)",
        }),
        threshold: 90,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.blockingAllRequestsAlarm.addAlarmAction(criticalAction);

    this.blockedRequestsSpikeAlarm = new AnomalyDetectionAlarm(
      this,
      "BlockedRequestsSpike",
      {
        alarmName: `${alarmNamePrefix}-blocked-requests-spike-anomaly`,
        alarmDescription:
          "Warning: blocked requests deviate from expected baseline",
        metric: blocked,
        stdDevs: 2,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator: ComparisonOperator.GREATER_THAN_UPPER_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.blockedRequestsSpikeAlarm.addAlarmAction(warningAction);
  }
}
