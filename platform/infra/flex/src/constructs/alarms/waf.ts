import { Duration, Fn, Stack } from "aws-cdk-lib";
import {
  Alarm,
  CfnAlarm,
  ComparisonOperator,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface WafAlarmsProps extends BaseAlarmsProps {
  readonly webAcl: CfnWebACL;
}

export class WafAlarms extends Construct {
  public readonly blockingAllRequestsAlarm: Alarm;
  public readonly blockedRequestsSpikeAlarm: CfnAlarm;

  constructor(scope: Construct, id: string, props: WafAlarmsProps) {
    super(scope, id);

    const { webAcl, criticalAction, warningAction, alarmNamePrefix } = props;

    const dimensions = {
      WebACL: Fn.select(2, Fn.split("/", webAcl.attrArn)),
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
      },
    );
    this.blockingAllRequestsAlarm.addAlarmAction(criticalAction);

    const spikeAlarmCfn = new CfnAlarm(this, "BlockedRequestsSpike", {
      alarmName: `${alarmNamePrefix}-blocked-requests-spike-anomaly`,
      alarmDescription:
        "Warning: blocked requests deviate from expected baseline (anomaly detection)",
      comparisonOperator: ComparisonOperator.GREATER_THAN_UPPER_THRESHOLD,
      evaluationPeriods: 1,
      thresholdMetricId: "expected_band",
      treatMissingData: "notBreaching",
      metrics: [
        {
          id: "blocked_requests",
          metricStat: {
            metric: {
              namespace: "AWS/WAFV2",
              metricName: "BlockedRequests",
              dimensions: Object.entries(dimensions).map(([name, value]) => ({
                name,
                value,
              })),
            },
            period: 300,
            stat: Stats.SUM,
          },
          returnData: true,
        },
        {
          id: "expected_band",
          // 2 = bandwidth in standard deviations
          expression: "ANOMALY_DETECTION_BAND(blocked_requests, 2)",
          label: "BlockedRequests (expected)",
          returnData: true,
        },
      ],
    });

    const spikeAlarmRef = Alarm.fromAlarmArn(
      this,
      "BlockedRequestsSpikeRef",
      spikeAlarmCfn.attrArn,
    );

    spikeAlarmCfn.alarmActions = [
      warningAction.bind(this, spikeAlarmRef).alarmActionArn,
    ];

    this.blockedRequestsSpikeAlarm = spikeAlarmCfn;
  }
}
