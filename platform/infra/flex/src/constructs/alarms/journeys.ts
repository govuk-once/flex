import { Duration } from "aws-cdk-lib";
import { MathExpression, Stats } from "aws-cdk-lib/aws-cloudwatch";
import {
  FilterPattern,
  type ILogGroup,
  type JsonPattern,
  MetricFilter,
} from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { toPascalCase } from "../../utils/routes";
import { createTwoWindowAlarm } from "./two-window-alarm";
import { BaseAlarmsProps } from "./types";

/**
 * A user journey is a group of public API routes that a consumer uses to
 * complete one task. Alarms are raised per journey, not per route, so that
 * a seldom used route erroring does not page and a journey failing across
 * several routes does. Journeys are keyed by name, which is stable; order in
 * the array carries no meaning.
 */
export interface JourneyDefinition {
  readonly name: string;
  readonly title: string;
  /** Availability target over the 28 day window, e.g. 0.995. */
  readonly slo: number;
  /** API Gateway resource path patterns; `*` matches any suffix. */
  readonly resourcePaths: readonly string[];
  readonly excludedResourcePaths?: readonly string[];
  /** Restrict to these HTTP methods; any method when omitted. */
  readonly httpMethods?: readonly string[];
  /** Where the fast burn alarm notifies. Slow burn is always a warning. */
  readonly fastBurnSeverity: "critical" | "warning";
  readonly alertText: string;
}

const USER_DATA_PATHS = [
  "/app/udp/v1/*",
  "/app/topics/v1/*",
  "/app/groups/v1/*",
];

export const JOURNEYS: readonly JourneyDefinition[] = [
  {
    name: "reads",
    title: "User data reads",
    slo: 0.995,
    resourcePaths: USER_DATA_PATHS,
    httpMethods: ["GET"],
    fastBurnSeverity: "critical",
    alertText:
      "READS DEGRADED: User data reads through FLEX are failing at a critical rate",
  },
  {
    name: "writes",
    title: "User data updates",
    slo: 0.999,
    resourcePaths: USER_DATA_PATHS,
    httpMethods: ["POST", "PATCH", "PUT", "DELETE"],
    fastBurnSeverity: "critical",
    alertText:
      "WRITES DEGRADED: User data updates through FLEX are failing at a critical rate",
  },
  {
    name: "driving",
    title: "Driving",
    slo: 0.995,
    resourcePaths: ["/app/dvla/v1/*"],
    excludedResourcePaths: ["/app/dvla/v1/test-notification"],
    fastBurnSeverity: "critical",
    alertText:
      "DRIVING DEGRADED: DVLA journeys through FLEX are failing at a critical rate. Check the DVLA gateway first",
  },
  {
    name: "notifications",
    title: "Notifications",
    slo: 0.995,
    resourcePaths: ["/app/uns/v1/*"],
    fastBurnSeverity: "critical",
    alertText:
      "NOTIFICATIONS DEGRADED: Notification requests through FLEX are failing at a critical rate",
  },
  {
    name: "travel",
    title: "Travel alerts",
    slo: 0.99,
    resourcePaths: ["/app/travel/v1/*"],
    fastBurnSeverity: "warning",
    alertText:
      "TRAVEL DEGRADED: Travel alert requests through FLEX are failing at an elevated rate",
  },
];

/**
 * Burn rate multipliers from the multi window method in the Google SRE
 * workbook. 14.4x spends 2% of a 28 day error budget in one hour and pages;
 * 6x spends 5% in six hours and warns.
 */
const FAST_BURN = {
  rate: 14.4,
  long: Duration.hours(1),
  short: Duration.minutes(5),
};
const SLOW_BURN = {
  rate: 6,
  long: Duration.hours(6),
  short: Duration.minutes(30),
};

/** Below this many valid requests in the window the rate is forced to zero. */
const MIN_VALID_REQUESTS = 20;

const METRIC_NAMESPACE = "Flex/Journeys";
const RUNBOOK =
  "docs/runbooks/api-gateway-5xx.md and docs/runbooks/external-service-outage.md";

export interface JourneyAlarmsProps extends BaseAlarmsProps {
  readonly accessLogGroup: ILogGroup;
  readonly journeys?: readonly JourneyDefinition[];
}

export class JourneyAlarms extends Construct {
  constructor(scope: Construct, id: string, props: JourneyAlarmsProps) {
    super(scope, id);

    const {
      accessLogGroup,
      alarmNamePrefix,
      criticalAction,
      warningAction,
      journeys = JOURNEYS,
    } = props;

    journeys.forEach((journey) => {
      const routeMatch = this.#routePattern(journey);

      const validRequests = this.#countFilter(accessLogGroup, {
        id: `${journey.name}Valid`,
        metricName: `${alarmNamePrefix}-${journey.name}-valid-requests`,
        pattern: FilterPattern.all(
          routeMatch,
          // Caller errors (other 4xx) are not the platform's failures, so
          // they are left out of the denominator as well as the numerator.
          this.#statusPattern(["2*", "3*", "5*", "429"]),
        ),
      });

      const failedRequests = this.#countFilter(accessLogGroup, {
        id: `${journey.name}Failed`,
        metricName: `${alarmNamePrefix}-${journey.name}-failed-requests`,
        pattern: FilterPattern.all(
          routeMatch,
          this.#statusPattern(["5*", "429"]),
        ),
      });

      const failureRate = (period: Duration) =>
        new MathExpression({
          expression: `IF(FILL(valid, 0) >= ${String(MIN_VALID_REQUESTS)}, 100 * FILL(failed, 0) / FILL(valid, 0), 0)`,
          usingMetrics: {
            valid: validRequests.metric({ statistic: Stats.SUM, period }),
            failed: failedRequests.metric({ statistic: Stats.SUM, period }),
          },
          period,
          label: `${journey.title} failed request rate (%)`,
        });

      const errorBudgetPercent = (1 - journey.slo) * 100;
      const fastThreshold = round(errorBudgetPercent * FAST_BURN.rate);
      const slowThreshold = round(errorBudgetPercent * SLOW_BURN.rate);
      const sloPercent = String(round(journey.slo * 100));

      const fastSeverity =
        journey.fastBurnSeverity === "critical" ? "Critical" : "Warning";
      createTwoWindowAlarm(this, {
        id: `${toPascalCase(journey.name)}FastBurn`,
        alarmName: `${alarmNamePrefix}-${journey.name}-fast-burn`,
        alarmDescription:
          `${fastSeverity}: ${journey.alertText}. ` +
          `Failed requests (5xx or 429) above ${String(fastThreshold)}% of valid requests ` +
          `over both the last hour and the last 5 minutes, with at least ${String(MIN_VALID_REQUESTS)} requests. ` +
          `That is a ${String(FAST_BURN.rate)}x burn of the ${sloPercent}% availability SLO. ` +
          `Runbook: ${RUNBOOK}`,
        rateMetric: failureRate,
        threshold: fastThreshold,
        longWindow: FAST_BURN.long,
        shortWindow: FAST_BURN.short,
        action:
          journey.fastBurnSeverity === "critical"
            ? criticalAction
            : warningAction,
      });

      createTwoWindowAlarm(this, {
        id: `${toPascalCase(journey.name)}SlowBurn`,
        alarmName: `${alarmNamePrefix}-${journey.name}-slow-burn`,
        alarmDescription:
          `Warning: ${journey.title} requests are failing faster than the ${sloPercent}% availability SLO allows. ` +
          `Failed requests above ${String(slowThreshold)}% of valid requests over both the last 6 hours and the last 30 minutes ` +
          `(a ${String(SLOW_BURN.rate)}x burn). Investigate in working hours. Runbook: ${RUNBOOK}`,
        rateMetric: failureRate,
        threshold: slowThreshold,
        longWindow: SLOW_BURN.long,
        shortWindow: SLOW_BURN.short,
        action: warningAction,
      });
    });
  }

  #routePattern(journey: JourneyDefinition): JsonPattern {
    const paths = FilterPattern.any(
      ...journey.resourcePaths.map((path) =>
        FilterPattern.stringValue("$.resourcePath", "=", path),
      ),
    );
    const exclusions = (journey.excludedResourcePaths ?? []).map((path) =>
      FilterPattern.stringValue("$.resourcePath", "!=", path),
    );
    const methods = journey.httpMethods
      ? [
          FilterPattern.any(
            ...journey.httpMethods.map((method) =>
              FilterPattern.stringValue("$.httpMethod", "=", method),
            ),
          ),
        ]
      : [];

    return FilterPattern.all(paths, ...exclusions, ...methods);
  }

  #statusPattern(statuses: readonly string[]): JsonPattern {
    return FilterPattern.any(
      ...statuses.map((status) =>
        FilterPattern.stringValue("$.status", "=", status),
      ),
    );
  }

  #countFilter(
    logGroup: ILogGroup,
    {
      id,
      metricName,
      pattern,
    }: { id: string; metricName: string; pattern: JsonPattern },
  ) {
    return new MetricFilter(this, id, {
      logGroup,
      metricNamespace: METRIC_NAMESPACE,
      metricName,
      filterPattern: pattern,
      metricValue: "1",
      defaultValue: 0,
    });
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
