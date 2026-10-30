import { Duration } from "aws-cdk-lib";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import {
  Alarm,
  AnomalyDetectionAlarm,
  ComparisonOperator,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

/**
 * NOTE: CloudFront metrics are only emitted to us-east-1. This construct
 * must be instantiated in a stack deployed to us-east-1 or alarm creation
 * will fail.
 *
 * TotalErrorRate requires "Additional Metrics" to be enabled on the
 * distribution (incurs additional cost).
 */
export interface CloudFrontAlarmsProps extends BaseAlarmsProps {
  readonly distribution: IDistribution;
  /**
   * Alarm when request volume falls far below its learned baseline. Only
   * meaningful where there is steady traffic to learn from, so off by default.
   */
  readonly trafficCliff?: boolean;
}

export class CloudFrontAlarms extends Construct {
  public readonly fiveXxErrorRateAlarm: Alarm;
  public readonly fourXxErrorRateAlarm: Alarm;
  public readonly totalErrorRateAlarm: Alarm;
  public readonly trafficCliffAlarm?: AnomalyDetectionAlarm;

  constructor(scope: Construct, id: string, props: CloudFrontAlarmsProps) {
    super(scope, id);

    const {
      distribution,
      criticalAction,
      warningAction,
      alarmNamePrefix,
      trafficCliff = false,
    } = props;

    const distDimensions = { DistributionId: distribution.distributionId };

    // 5xxErrorRate is already a percentage (0-100), so threshold is 1, not 0.01.
    this.fiveXxErrorRateAlarm = new Alarm(this, "5xxErrorRate", {
      alarmName: `${alarmNamePrefix}-5xx-error-rate`,
      alarmDescription:
        "Critical: EDGE FAILURE: CloudFront 5xx error rate above 1% over 5 consecutive 1 minute periods. Runbook: docs/runbooks/api-gateway-5xx.md",
      metric: new Metric({
        namespace: "AWS/CloudFront",
        metricName: "5xxErrorRate",
        dimensionsMap: distDimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fiveXxErrorRateAlarm.addAlarmAction(criticalAction);

    // 4xxErrorRate also pre-percentaged.
    this.fourXxErrorRateAlarm = new Alarm(this, "4xxErrorRate", {
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription:
        "Warning: 4xx error rate above 5% over 5 consecutive 1 minute periods",
      metric: new Metric({
        namespace: "AWS/CloudFront",
        metricName: "4xxErrorRate",
        dimensionsMap: distDimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(1),
      }),
      threshold: 5,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fourXxErrorRateAlarm.addAlarmAction(warningAction);

    // TotalErrorRate (4xx + 5xx) - only emitted when Additional Metrics is on.
    this.totalErrorRateAlarm = new Alarm(this, "TotalErrorRate", {
      alarmName: `${alarmNamePrefix}-total-error-rate`,
      alarmDescription:
        "Warning: total error rate above 5% over 5 consecutive 1 minute periods",
      metric: new Metric({
        namespace: "AWS/CloudFront",
        metricName: "TotalErrorRate",
        dimensionsMap: distDimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(1),
      }),
      threshold: 5,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.totalErrorRateAlarm.addAlarmAction(warningAction);

    if (trafficCliff) {
      // If nothing reaches the edge (DNS, certificate, a distribution or
      // viewer function change) every error rate reads zero, so a drop in
      // volume is the only signal. Missing data is itself the symptom.
      this.trafficCliffAlarm = new AnomalyDetectionAlarm(this, "TrafficCliff", {
        alarmName: `${alarmNamePrefix}-traffic-cliff`,
        alarmDescription:
          "Critical: EDGE FAILURE: requests reaching CloudFront have fallen below the expected band for 3 consecutive 5 minute periods, " +
          "or stopped altogether. Check DNS, the certificate, the distribution and the viewer request function. Runbook: docs/runbooks/verify-environment-health.md",
        metric: new Metric({
          namespace: "AWS/CloudFront",
          metricName: "Requests",
          dimensionsMap: distDimensions,
          statistic: Stats.SUM,
          period: Duration.minutes(5),
        }),
        stdDevs: 3,
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        comparisonOperator: ComparisonOperator.LESS_THAN_LOWER_THRESHOLD,
        treatMissingData: TreatMissingData.BREACHING,
      });
      this.trafficCliffAlarm.addAlarmAction(criticalAction);
    }
  }
}
