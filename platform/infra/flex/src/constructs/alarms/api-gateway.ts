import { Duration } from "aws-cdk-lib";
import { IRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Alarm,
  ComparisonOperator,
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

    // 5XXError is reported as a ratio (errors / requests) when averaged.
    // 1% threshold = 0.01.
    this.fiveXxAlarm = new Alarm(this, "5xxErrorRate", {
      alarmName: `${alarmNamePrefix}-5xx-error-rate`,
      alarmDescription:
        "Critical: 5XX error rate above 1% over 5 consecutive 1 minute periods",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "5XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(1),
      }),
      threshold: 0.01,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fiveXxAlarm.addAlarmAction(criticalAction);

    // 4XXError as a ratio. 5% threshold = 0.05.
    this.fourXxAlarm = new Alarm(this, "4xxErrorRate", {
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription:
        "Warning: 4XX error rate above 5% over 5 consecutive 1 minute periods",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "4XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(1),
      }),
      threshold: 0.05,
      evaluationPeriods: 5,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fourXxAlarm.addAlarmAction(warningAction);

    // p95 end-to-end latency. p95 (not p99) and an M-of-N evaluation window
    // keep transient cold-start spikes from paging while still catching a
    // sustained regression.
    this.p95LatencyAlarm = new Alarm(this, "P95Latency", {
      alarmName: `${alarmNamePrefix}-p95-latency`,
      alarmDescription:
        "Warning: p95 latency above 3000ms for 2 of 3 consecutive 5 minute periods",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "Latency",
        dimensionsMap: dimensions,
        statistic: Stats.p(95),
        period: Duration.minutes(5),
      }),
      threshold: 3000,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.p95LatencyAlarm.addAlarmAction(warningAction);

    // p95 integration latency - backend-only latency, helps distinguish
    // API Gateway overhead from backend slowness when p95 latency fires.
    // Same p95 + M-of-N tuning as the end-to-end alarm to ride out cold-start
    // spikes.
    this.integrationP95LatencyAlarm = new Alarm(this, "IntegrationP95Latency", {
      alarmName: `${alarmNamePrefix}-integration-p95-latency`,
      alarmDescription:
        "Warning: integration p95 latency above 2900ms for 2 of 3 consecutive 5 minute periods",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "IntegrationLatency",
        dimensionsMap: dimensions,
        statistic: Stats.p(95),
        period: Duration.minutes(5),
      }),
      threshold: 2900,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.integrationP95LatencyAlarm.addAlarmAction(warningAction);
  }
}
