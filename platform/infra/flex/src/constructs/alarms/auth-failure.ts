import { Duration } from "aws-cdk-lib";
import { MathExpression, Stats } from "aws-cdk-lib/aws-cloudwatch";
import {
  FilterPattern,
  type ILogGroup,
  MetricFilter,
} from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { createTwoWindowAlarm } from "./two-window-alarm";
import { BaseAlarmsProps } from "./types";

export interface AuthFailureAlarmsProps extends BaseAlarmsProps {
  readonly accessLogGroup: ILogGroup;
}

/** Share of requests rejected for auth reasons above which the API is effectively down. */
const REJECTED_PERCENT = 50;
const MIN_REQUESTS = 20;
const LONG_WINDOW = Duration.minutes(15);
const SHORT_WINDOW = Duration.minutes(5);

/**
 * The authorizer returns Deny on any error, so an outage of Cognito, the JWKS
 * endpoint or the authorizer itself shows as a 401 or 403 on every request
 * rather than a 5xx. This alarm measures that symptom directly.
 */
export class AuthFailureAlarms extends Construct {
  constructor(scope: Construct, id: string, props: AuthFailureAlarmsProps) {
    super(scope, id);

    const { accessLogGroup, alarmNamePrefix, criticalAction } = props;

    const requests = new MetricFilter(this, "Requests", {
      logGroup: accessLogGroup,
      metricNamespace: "Flex/ApiGateway",
      metricName: `${alarmNamePrefix}-requests`,
      filterPattern: FilterPattern.stringValue("$.status", "=", "*"),
      metricValue: "1",
      defaultValue: 0,
    });

    const rejected = new MetricFilter(this, "Rejected", {
      logGroup: accessLogGroup,
      metricNamespace: "Flex/ApiGateway",
      metricName: `${alarmNamePrefix}-rejected`,
      filterPattern: FilterPattern.any(
        FilterPattern.stringValue("$.status", "=", "401"),
        FilterPattern.stringValue("$.status", "=", "403"),
      ),
      metricValue: "1",
      defaultValue: 0,
    });

    createTwoWindowAlarm(this, {
      id: "AuthFailure",
      alarmName: `${alarmNamePrefix}-auth-failure`,
      alarmDescription:
        "Critical: AUTH FAILURE: FLEX is rejecting most authenticated requests. " +
        `401 and 403 responses above ${String(REJECTED_PERCENT)}% of requests over both the last ` +
        `${String(LONG_WINDOW.toMinutes())} and ${String(SHORT_WINDOW.toMinutes())} minutes, ` +
        `with at least ${String(MIN_REQUESTS)} requests. Check Cognito, the JWKS endpoint and the authorizer logs ` +
        "for 'JWT verification failed', then recent deploys of the auth domain. Runbook: docs/runbooks/api-gateway-5xx.md",
      rateMetric: (period) =>
        new MathExpression({
          expression: `IF(FILL(requests, 0) >= ${String(MIN_REQUESTS)}, 100 * FILL(rejected, 0) / FILL(requests, 0), 0)`,
          usingMetrics: {
            requests: requests.metric({ statistic: Stats.SUM, period }),
            rejected: rejected.metric({ statistic: Stats.SUM, period }),
          },
          period,
          label: "Auth rejected rate (%)",
        }),
      threshold: REJECTED_PERCENT,
      longWindow: LONG_WINDOW,
      shortWindow: SHORT_WINDOW,
      action: criticalAction,
    });
  }
}
