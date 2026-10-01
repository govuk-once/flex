import { Duration } from "aws-cdk-lib";
import { IRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Alarm,
  ComparisonOperator,
  IMetric,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { FilterPattern, ILogGroup, MetricFilter } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface ApiGatewayAlarmsProps extends BaseAlarmsProps {
  readonly api: IRestApi;
  readonly authFailureAccessLogGroup?: ILogGroup;
}

export class ApiGatewayAlarms extends Construct {
  public readonly fiveXxAlarm: Alarm;
  public readonly fourXxAlarm: Alarm;
  public readonly endToEndP95LatencyAlarm: Alarm;
  public readonly integrationP95LatencyAlarm: Alarm;

  constructor(scope: Construct, id: string, props: ApiGatewayAlarmsProps) {
    super(scope, id);

    const {
      api,
      authFailureAccessLogGroup,
      criticalAction,
      warningAction,
      alarmNamePrefix,
    } = props;

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

    const fourXxErrorRate: IMetric = authFailureAccessLogGroup
      ? this.#authFailureRate(
          authFailureAccessLogGroup,
          dimensions,
          errorRatePeriod,
          alarmNamePrefix,
        )
      : new Metric({
          namespace: "AWS/ApiGateway",
          metricName: "4XXError",
          dimensionsMap: dimensions,
          statistic: Stats.AVERAGE,
          period: errorRatePeriod,
        });
    const fourXxErrorLabel = authFailureAccessLogGroup
      ? "401/403 error rate"
      : "4XX error rate";

    this.fourXxAlarm = new Alarm(this, "4xxErrorRate", {
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription:
        `Warning: ${fourXxErrorLabel} above ${fourXxErrorRatePercent.toString()}% ` +
        `over ${errorRateEvaluationPeriods.toString()} consecutive ` +
        `${errorRatePeriod.toMinutes().toString()} minute periods`,
      metric: fourXxErrorRate,
      threshold: fourXxErrorRatePercent / 100,
      evaluationPeriods: errorRateEvaluationPeriods,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fourXxAlarm.addAlarmAction(warningAction);

    const latencyPeriod = Duration.minutes(5);
    const latencyEvaluationPeriods = 3;
    const latencyDatapointsToAlarm = 2;
    const endToEndLatencyThresholdMs = 3000;
    const integrationLatencyThresholdMs = 2900;
    const minRequestsForLatencyAlarms = 40;

    const requestCount = new Metric({
      namespace: "AWS/ApiGateway",
      metricName: "Count",
      dimensionsMap: dimensions,
      statistic: Stats.SUM,
      period: latencyPeriod,
    });

    const gatedEndToEndP95Latency = new MathExpression({
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
      label: `end-to-end p95 latency (min ${minRequestsForLatencyAlarms.toString()} requests per period)`,
    });

    this.endToEndP95LatencyAlarm = gatedEndToEndP95Latency.createAlarm(
      this,
      "P95Latency",
      {
        alarmName: `${alarmNamePrefix}-e2e-p95-latency`,
        alarmDescription:
          `Warning: end-to-end p95 latency above ${endToEndLatencyThresholdMs.toString()}ms ` +
          `for ${latencyDatapointsToAlarm.toString()} of ${latencyEvaluationPeriods.toString()} consecutive ` +
          `${latencyPeriod.toMinutes().toString()} minute periods ` +
          `(suppressed below ${minRequestsForLatencyAlarms.toString()} requests per period)`,
        threshold: endToEndLatencyThresholdMs,
        evaluationPeriods: latencyEvaluationPeriods,
        datapointsToAlarm: latencyDatapointsToAlarm,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );
    this.endToEndP95LatencyAlarm.addAlarmAction(warningAction);

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

  #authFailureRate(
    accessLogGroup: ILogGroup,
    dimensions: Record<string, string>,
    period: Duration,
    alarmNamePrefix: string,
  ): IMetric {
    const authFailures = new MetricFilter(this, "AuthFailures", {
      logGroup: accessLogGroup,
      metricNamespace: "Flex/ApiGateway",
      metricName: `${alarmNamePrefix}-auth-failures`,
      filterPattern: FilterPattern.any(
        FilterPattern.stringValue("$.status", "=", "401"),
        FilterPattern.stringValue("$.status", "=", "403"),
      ),
      metricValue: "1",
      defaultValue: 0,
    });

    return new MathExpression({
      expression: "IF(requests > 0, authFailures / requests, 0)",
      usingMetrics: {
        authFailures: authFailures.metric({ statistic: Stats.SUM, period }),
        requests: new Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Count",
          dimensionsMap: dimensions,
          statistic: Stats.SUM,
          period,
        }),
      },
      period,
      label: "401/403 error rate",
    });
  }
}
