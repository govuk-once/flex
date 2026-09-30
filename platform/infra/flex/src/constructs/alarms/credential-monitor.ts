import {
  METRIC_NAMESPACE,
  MetricName,
} from "@platform/credential-monitor/metrics";
import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  type IAlarmAction,
  type IMetric,
  MathExpression,
  Metric,
  Stats,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { BaseAlarmsProps } from "./types";

export interface CredentialMonitorAlarmsProps extends BaseAlarmsProps {
  readonly environment: string;
  readonly monitorFunction: IFunction;
}

interface CredentialAlarmDefinition {
  readonly id: string;
  readonly nameSuffix: string;
  readonly description: string;
  readonly metric: IMetric;
  readonly threshold: number;
  readonly comparisonOperator: ComparisonOperator;
  readonly evaluationPeriods: number;
  readonly treatMissingData: TreatMissingData;
  readonly action: IAlarmAction;
}

const HOUR = Duration.hours(1);

export class CredentialMonitorAlarms extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: CredentialMonitorAlarmsProps,
  ) {
    super(scope, id);

    const {
      environment,
      monitorFunction,
      alarmNamePrefix,
      criticalAction,
      warningAction,
    } = props;

    const credentialMetric = (metricName: MetricName, statistic: string) =>
      new Metric({
        namespace: METRIC_NAMESPACE,
        metricName,
        dimensionsMap: { Environment: environment },
        statistic,
        period: HOUR,
      });

    const definitions: CredentialAlarmDefinition[] = [
      {
        id: "SecretRotationOverdue",
        nameSuffix: "secret-rotation-overdue",
        description:
          "Warning: one or more secrets are more than 7 days past their rotation date, see the credential monitor logs for which",
        metric: credentialMetric(
          MetricName.SecretRotationOverdue,
          Stats.MAXIMUM,
        ),
        threshold: 0,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.IGNORE,
        action: warningAction,
      },
      {
        id: "CognitoConfigDrift",
        nameSuffix: "cognito-config-drift",
        description:
          "Critical: Cognito configuration in SSM differs from the deployed authorizer, a deployment is required",
        metric: credentialMetric(MetricName.CognitoConfigDrift, Stats.MAXIMUM),
        threshold: 0,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.IGNORE,
        action: criticalAction,
      },
      {
        id: "NotReporting",
        nameSuffix: "not-reporting",
        description:
          "Warning: the credential monitor has not completed a run in 3 hours, so rotation and drift are unmonitored",
        metric: new MathExpression({
          expression: "FILL(success, 0)",
          usingMetrics: {
            success: credentialMetric(
              MetricName.CredentialMonitorSuccess,
              Stats.SUM,
            ),
          },
          period: HOUR,
          label: "Successful runs",
        }),
        threshold: 1,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        action: warningAction,
      },
      {
        id: "Failing",
        nameSuffix: "failing",
        description:
          "Warning: the credential monitor has failed in each of the last 3 hours, see its logs",
        metric: monitorFunction.metricErrors({
          statistic: Stats.SUM,
          period: HOUR,
        }),
        threshold: 0,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 3,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        action: warningAction,
      },
    ];

    definitions.forEach((definition) => {
      const alarm = new Alarm(this, definition.id, {
        alarmName: `${alarmNamePrefix}-${definition.nameSuffix}`,
        alarmDescription: definition.description,
        metric: definition.metric,
        threshold: definition.threshold,
        evaluationPeriods: definition.evaluationPeriods,
        datapointsToAlarm: definition.evaluationPeriods,
        comparisonOperator: definition.comparisonOperator,
        treatMissingData: definition.treatMissingData,
      });
      alarm.addAlarmAction(definition.action);
    });
  }
}
