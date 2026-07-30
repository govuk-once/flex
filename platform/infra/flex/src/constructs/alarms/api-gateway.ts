import { Duration } from "aws-cdk-lib";
import { IRestApi } from "aws-cdk-lib/aws-apigateway";
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

export interface ApiGatewayAlarmsProps extends BaseAlarmsProps {
  readonly api: IRestApi;
}

export class ApiGatewayAlarms extends Construct {
  public readonly fiveXxAlarm: Alarm;
  public readonly fourXxAlarm: Alarm;
  public readonly p95LatencyAlarm: Alarm;
  public readonly integrationP95LatencyAlarm: Alarm;

  constructor(scope: Construct, id: string, props: ApiGatewayAlarmsProps) {
    super(scope, id);

    const { api, criticalAction, warningAction, alarmNamePrefix } = props;

    const dimensions = {
      ApiName: api.restApiName,
      Stage: api.deploymentStage.stageName,
    };

    const errorRatePeriod = Duration.minutes(1);
    const errorRateEvaluationPeriods = 5;
    const fiveXxErrorRatePercent = 1;
    const fourXxErrorRatePercent = 5;

    // 5XXError and 4XXError are reported as ratios (errors / requests) when
    // averaged, so the percent thresholds are divided by 100.
    this.fiveXxAlarm = new Alarm(this, "5xxErrorRate", {
      alarmName: `${alarmNamePrefix}-5xx-error-rate`,
      alarmDescription:
        `Critical: 5XX error rate above ${fiveXxErrorRatePercent.toString()}% ` +
        `over ${errorRateEvaluationPeriods.toString()} consecutive ` +
        `${errorRatePeriod.toMinutes().toString()} minute periods`,
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "5XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: errorRatePeriod,
      }),
      threshold: fiveXxErrorRatePercent / 100,
      evaluationPeriods: errorRateEvaluationPeriods,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fiveXxAlarm.addAlarmAction(criticalAction);

    this.fourXxAlarm = new Alarm(this, "4xxErrorRate", {
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription:
        `Warning: 4XX error rate above ${fourXxErrorRatePercent.toString()}% ` +
        `over ${errorRateEvaluationPeriods.toString()} consecutive ` +
        `${errorRatePeriod.toMinutes().toString()} minute periods`,
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "4XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: errorRatePeriod,
      }),
      threshold: fourXxErrorRatePercent / 100,
      evaluationPeriods: errorRateEvaluationPeriods,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fourXxAlarm.addAlarmAction(warningAction);

    const latencyPeriod = Duration.minutes(5);
    const latencyEvaluationPeriods = 3;
    const latencyDatapointsToAlarm = 2;
    const latencyThresholdMs = 3000;
    const integrationLatencyThresholdMs = 2900;
    const minRequestsForLatencyAlarms = 40;

    const requestCount = new Metric({
      namespace: "AWS/ApiGateway",
      metricName: "Count",
      dimensionsMap: dimensions,
      statistic: Stats.SUM,
      period: latencyPeriod,
    });

    const gatedP95Latency = new MathExpression({
      expression: `IF(requests >= ${minRequestsForLatencyAlarms.toString()}, latency, 0)`,
      usingMetrics: {
        latency: new Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Latency",
          dimensionsMap: dimensions,
          statistic: Stats.p(95),
          period: latencyPeriod,
        }),
        requests: requestCount,
      },
      period: latencyPeriod,
      label: `p95 latency (min ${minRequestsForLatencyAlarms.toString()} requests per period)`,
    });

    this.p95LatencyAlarm = gatedP95Latency.createAlarm(this, "P95Latency", {
      alarmName: `${alarmNamePrefix}-p95-latency`,
      alarmDescription:
        `Warning: p95 latency above ${latencyThresholdMs.toString()}ms ` +
        `for ${latencyDatapointsToAlarm.toString()} of ${latencyEvaluationPeriods.toString()} consecutive ` +
        `${latencyPeriod.toMinutes().toString()} minute periods ` +
        `(suppressed below ${minRequestsForLatencyAlarms.toString()} requests per period)`,
      threshold: latencyThresholdMs,
      evaluationPeriods: latencyEvaluationPeriods,
      datapointsToAlarm: latencyDatapointsToAlarm,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.p95LatencyAlarm.addAlarmAction(warningAction);

    const gatedIntegrationP95Latency = new MathExpression({
      expression: `IF(requests >= ${minRequestsForLatencyAlarms.toString()}, latency, 0)`,
      usingMetrics: {
        latency: new Metric({
          namespace: "AWS/ApiGateway",
          metricName: "IntegrationLatency",
          dimensionsMap: dimensions,
          statistic: Stats.p(95),
          period: latencyPeriod,
        }),
        requests: requestCount,
      },
      period: latencyPeriod,
      label: `integration p95 latency (min ${minRequestsForLatencyAlarms.toString()} requests per period)`,
    });

    this.integrationP95LatencyAlarm = gatedIntegrationP95Latency.createAlarm(
      this,
      "IntegrationP95Latency",
      {
        alarmName: `${alarmNamePrefix}-integration-p95-latency`,
        alarmDescription:
          `Warning: integration p95 latency above ${integrationLatencyThresholdMs.toString()}ms ` +
          `for ${latencyDatapointsToAlarm.toString()} of ${latencyEvaluationPeriods.toString()} consecutive ` +
          `${latencyPeriod.toMinutes().toString()} minute periods ` +
          `(suppressed below ${minRequestsForLatencyAlarms.toString()} requests per period)`,
        threshold: integrationLatencyThresholdMs,
        evaluationPeriods: latencyEvaluationPeriods,
        datapointsToAlarm: latencyDatapointsToAlarm,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.integrationP95LatencyAlarm.addAlarmAction(warningAction);
  }
}
