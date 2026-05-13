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
  public readonly p99LatencyAlarm: Alarm;
  public readonly integrationP99LatencyAlarm: Alarm;

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
      alarmDescription: "Critical: 5XX error rate above 1% over 5 minutes",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "5XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(5),
      }),
      threshold: 0.01,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fiveXxAlarm.addAlarmAction(criticalAction);

    // 4XXError as a ratio. 5% threshold = 0.05.
    this.fourXxAlarm = new Alarm(this, "4xxErrorRate", {
      alarmName: `${alarmNamePrefix}-4xx-error-rate`,
      alarmDescription: "Warning: 4XX error rate above 5% over 5 minutes",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "4XXError",
        dimensionsMap: dimensions,
        statistic: Stats.AVERAGE,
        period: Duration.minutes(5),
      }),
      threshold: 0.05,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.fourXxAlarm.addAlarmAction(warningAction);

    // p99 end-to-end latency
    this.p99LatencyAlarm = new Alarm(this, "P99Latency", {
      alarmName: `${alarmNamePrefix}-p99-latency`,
      alarmDescription: "Warning: p99 latency above 3000ms over 5 minutes",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "Latency",
        dimensionsMap: dimensions,
        statistic: Stats.p(99),
        period: Duration.minutes(5),
      }),
      threshold: 3000,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.p99LatencyAlarm.addAlarmAction(warningAction);

    // p99 integration latency - backend-only latency, helps distinguish
    // API Gateway overhead from backend slowness when p99 latency fires.
    this.integrationP99LatencyAlarm = new Alarm(this, "IntegrationP99Latency", {
      alarmName: `${alarmNamePrefix}-integration-p99-latency`,
      alarmDescription:
        "Warning: integration p99 latency above 2900ms over 5 minutes",
      metric: new Metric({
        namespace: "AWS/ApiGateway",
        metricName: "IntegrationLatency",
        dimensionsMap: dimensions,
        statistic: Stats.p(99),
        period: Duration.minutes(5),
      }),
      threshold: 2900,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.integrationP99LatencyAlarm.addAlarmAction(warningAction);
  }
}
