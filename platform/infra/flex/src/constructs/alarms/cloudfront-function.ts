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
export interface CloudFrontFunctionAlarmsProps extends BaseAlarmsProps {
  readonly distribution: IDistribution;
  readonly cloudfrontFunction: IFunction;
}

export class CloudFrontFunctionAlarms extends Construct {
  public readonly functionExecutionErrorsAlarm: Alarm;
  public readonly functionThrottlesAlarm: Alarm;
  public readonly functionValidationErrorsAlarm: Alarm;

  constructor(
    scope: Construct,
    id: string,
    props: CloudFrontFunctionAlarmsProps,
  ) {
    super(scope, id);

    const {
      distribution,
      cloudfrontFunction,
      criticalAction,
      warningAction,
      alarmNamePrefix,
    } = props;

    const fnDimensions = {
      DistributionId: distribution.distributionId,
      FunctionName: cloudfrontFunction.functionName,
    };

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
