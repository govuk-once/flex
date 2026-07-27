import { Duration } from "aws-cdk-lib";
import { IRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Alarm,
  ComparisonOperator,
  IAlarmAction,
  IMetric,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

// These floors trade a small blind spot at very low traffic for far fewer
// false positives, and are starting points to tune against real request
// volume. A rate needs a meaningful denominator; a p95 needs a body of
// samples; MIN_ERRORS additionally stops one or two stray errors alerting on a
// high rate. The count-based 5XX alarm below covers the low-traffic gap these
// floors leave, since it does not depend on volume at all.
const MIN_ERROR_RATE_REQUESTS = 100;
const MIN_ERRORS = 3;
const MIN_LATENCY_SAMPLES = 100;
const MIN_5XX_COUNT = 5;

interface MathAlarmSpec {
  readonly id: string;
  readonly alarmName: string;
  readonly alarmDescription: string;
  readonly expression: string;
  readonly usingMetrics: Record<string, IMetric>;
  readonly threshold: number;
  readonly period: Duration;
  readonly evaluationPeriods: number;
  readonly datapointsToAlarm?: number;
  readonly action: IAlarmAction;
}

export interface ApiGatewayAlarmsProps extends BaseAlarmsProps {
  readonly api: IRestApi;
}

export class ApiGatewayAlarms extends Construct {
  public readonly fiveXxAlarm: Alarm;
  public readonly fiveXxCountAlarm: Alarm;
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

    const apiMetric = (
      metricName: string,
      statistic: string,
      period: Duration,
    ): Metric =>
      new Metric({
        namespace: "AWS/ApiGateway",
        metricName,
        dimensionsMap: dimensions,
        statistic,
        period,
      });

    const createMathAlarm = (spec: MathAlarmSpec): Alarm => {
      const alarm = new Alarm(this, spec.id, {
        alarmName: spec.alarmName,
        alarmDescription: spec.alarmDescription,
        metric: new MathExpression({
          expression: spec.expression,
          usingMetrics: spec.usingMetrics,
          period: spec.period,
        }),
        threshold: spec.threshold,
        evaluationPeriods: spec.evaluationPeriods,
        datapointsToAlarm: spec.datapointsToAlarm,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(spec.action);

      return alarm;
    };

    // Error rate. Gated on both the denominator (request count) and the
    // absolute error count: a rate is only meaningful once there are enough
    // requests, and MIN_ERRORS keeps one or two errors from tripping a high
    // rate. Below either floor the IF resolves to a real 0, which is evaluated
    // as non-breaching (the period is not skipped), so a quiet period actively
    // clears the alarm rather than leaving stale breaching datapoints.
    const createErrorRateAlarm = (spec: {
      id: string;
      alarmName: string;
      alarmDescription: string;
      metricName: "4XXError" | "5XXError";
      threshold: number;
      action: IAlarmAction;
    }): Alarm => {
      const period = Duration.minutes(1);
      const errors = apiMetric(spec.metricName, Stats.SUM, period);
      const requests = apiMetric("Count", Stats.SAMPLE_COUNT, period);

      return createMathAlarm({
        id: spec.id,
        alarmName: spec.alarmName,
        alarmDescription: spec.alarmDescription,
        expression: `IF(requests >= ${String(MIN_ERROR_RATE_REQUESTS)} AND errors >= ${String(MIN_ERRORS)}, errors / requests, 0)`,
        usingMetrics: { errors, requests },
        threshold: spec.threshold,
        period,
        evaluationPeriods: 5,
        action: spec.action,
      });
    };

    // Latency. Gated on the request count so the p95 is computed from a body of
    // samples rather than the slowest one or two requests. Below the floor the
    // IF resolves to a non-breaching 0, as above.
    const createLatencyAlarm = (spec: {
      id: string;
      alarmName: string;
      alarmDescription: string;
      metricName: "Latency" | "IntegrationLatency";
      threshold: number;
      action: IAlarmAction;
    }): Alarm => {
      const period = Duration.minutes(5);
      const latency = apiMetric(spec.metricName, Stats.p(95), period);
      const samples = apiMetric(spec.metricName, Stats.SAMPLE_COUNT, period);

      return createMathAlarm({
        id: spec.id,
        alarmName: spec.alarmName,
        alarmDescription: spec.alarmDescription,
        expression: `IF(samples >= ${String(MIN_LATENCY_SAMPLES)}, latency, 0)`,
        usingMetrics: { latency, samples },
        threshold: spec.threshold,
        period,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        action: spec.action,
      });
    };

    this.fiveXxAlarm = createErrorRateAlarm({
      id: "5xxErrorRate",
      alarmName: `${alarmNamePrefix}-5xx-error-rate`,
      alarmDescription: `Critical: 5XX error rate above 1% for 5 consecutive 1 minute periods, evaluated only when each period has at least ${String(MIN_ERROR_RATE_REQUESTS)} requests and ${String(MIN_ERRORS)} 5XX responses`,
      metricName: "5XXError",
      threshold: 0.01,
      action: criticalAction,
    });

    this.fourXxAlarm = createErrorRateAlarm({
      id: "4xxErrorRate",
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription: `Warning: 4XX error rate above 5% for 5 consecutive 1 minute periods, evaluated only when each period has at least ${String(MIN_ERROR_RATE_REQUESTS)} requests and ${String(MIN_ERRORS)} 4XX responses`,
      metricName: "4XXError",
      threshold: 0.05,
      action: warningAction,
    });

    // Volume-independent safety net for the low-traffic periods where the rate
    // alarm cannot reach its request floor. An absolute 5XX count is meaningful
    // at any volume.
    this.fiveXxCountAlarm = new Alarm(this, "5xxCount", {
      alarmName: `${alarmNamePrefix}-5xx-count`,
      alarmDescription: `Critical: at least ${String(MIN_5XX_COUNT)} 5XX responses in a 5 minute period`,
      metric: apiMetric("5XXError", Stats.SUM, Duration.minutes(5)),
      threshold: MIN_5XX_COUNT,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fiveXxCountAlarm.addAlarmAction(criticalAction);

    this.p95LatencyAlarm = createLatencyAlarm({
      id: "P95Latency",
      alarmName: `${alarmNamePrefix}-p95-latency`,
      alarmDescription: `Warning: p95 latency above 3000ms for 2 of 3 consecutive 5 minute periods, evaluated only when each period holds at least ${String(MIN_LATENCY_SAMPLES)} requests`,
      metricName: "Latency",
      threshold: 3000,
      action: warningAction,
    });

    // Integration latency is backend-only, and helps distinguish API Gateway
    // overhead from backend slowness when the end-to-end alarm fires.
    this.integrationP95LatencyAlarm = createLatencyAlarm({
      id: "IntegrationP95Latency",
      alarmName: `${alarmNamePrefix}-integration-p95-latency`,
      alarmDescription: `Warning: integration p95 latency above 2900ms for 2 of 3 consecutive 5 minute periods, evaluated only when each period holds at least ${String(MIN_LATENCY_SAMPLES)} requests`,
      metricName: "IntegrationLatency",
      threshold: 2900,
      action: warningAction,
    });
  }
}
