import { Duration } from "aws-cdk-lib";
import { IDistribution, IFunction } from "aws-cdk-lib/aws-cloudfront";
import {
  Alarm,
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
  readonly viewerRequestFunction: IFunction;
}

export class CloudFrontAlarms extends Construct {
  public readonly fiveXxErrorRateAlarm: Alarm;
  public readonly fourXxErrorRateAlarm: Alarm;
  public readonly totalErrorRateAlarm: Alarm;
  public readonly functionExecutionErrorsAlarm: Alarm;
  public readonly functionThrottlesAlarm: Alarm;
  public readonly functionValidationErrorsAlarm: Alarm;

  constructor(scope: Construct, id: string, props: CloudFrontAlarmsProps) {
    super(scope, id);

    const {
      distribution,
      viewerRequestFunction,
      criticalAction,
      warningAction,
      alarmNamePrefix,
    } = props;

    const distDimensions = { DistributionId: distribution.distributionId };
    const fnDimensions = {
      DistributionId: distribution.distributionId,
      FunctionName: viewerRequestFunction.functionName,
    };

    // 5xxErrorRate is already a percentage (0-100), so threshold is 1, not 0.01.
    this.fiveXxErrorRateAlarm = new Alarm(this, "5xxErrorRate", {
      alarmName: `${alarmNamePrefix}-5xx-error-rate`,
      alarmDescription:
        "Critical: 5xx error rate above 1% over 5 consecutive 1 minute periods",
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

    // CloudFront Function execution errors - runs on every viewer request,
    // any error means requests couldn't be processed.
    this.functionExecutionErrorsAlarm = new Alarm(
      this,
      "FunctionExecutionErrors",
      {
        alarmName: `${alarmNamePrefix}-function-execution-errors`,
        alarmDescription:
          "Critical: viewer request function execution errors over 5 consecutive 1 minute periods",
        metric: new Metric({
          namespace: "AWS/CloudFront",
          metricName: "FunctionExecutionErrors",
          dimensionsMap: fnDimensions,
          statistic: Stats.SUM,
          period: Duration.minutes(1),
        }),
        threshold: 0,
        evaluationPeriods: 5,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.functionExecutionErrorsAlarm.addAlarmAction(criticalAction);

    // Function throttles - function exceeded compute time limit.
    this.functionThrottlesAlarm = new Alarm(this, "FunctionThrottles", {
      alarmName: `${alarmNamePrefix}-function-throttles`,
      alarmDescription:
        "Warning: viewer request function throttled over 5 consecutive 1 minute periods",
      metric: new Metric({
        namespace: "AWS/CloudFront",
        metricName: "FunctionThrottles",
        dimensionsMap: fnDimensions,
        statistic: Stats.SUM,
        period: Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.functionThrottlesAlarm.addAlarmAction(criticalAction);

    // Function validation errors - function returned malformed event back
    // to CloudFront (bad headers, response shape, etc).
    this.functionValidationErrorsAlarm = new Alarm(
      this,
      "FunctionValidationErrors",
      {
        alarmName: `${alarmNamePrefix}-function-validation-errors`,
        alarmDescription:
          "Warning: viewer request function validation errors over 2 consecutive 1 minute periods",
        metric: new Metric({
          namespace: "AWS/CloudFront",
          metricName: "FunctionValidationErrors",
          dimensionsMap: fnDimensions,
          statistic: Stats.SUM,
          period: Duration.minutes(1),
        }),
        threshold: 0,
        evaluationPeriods: 2,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.functionValidationErrorsAlarm.addAlarmAction(warningAction);
  }
}
