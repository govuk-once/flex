import { describe, expect, it } from "vitest";

import {
  apiLatencyQuantile,
  LAMBDA_VARIANTS,
  lambdaDurationByDomain,
  lambdaErrorsByStage,
  lambdaInvocationsByDomain,
  lambdaSeriesSelector,
  metricsInsightsInvocationsByDomain,
} from "./queries";

const target = {
  apiName: "Api",
  apiStage: "prod",
  method: "GET",
  resource: "/app/dvla/v1/vehicle-enquiry/{reg}",
};

describe("apiLatencyQuantile", () => {
  it("selects the method-level latency histogram for one route", () => {
    expect(apiLatencyQuantile(0.99, target)).toBe(
      'histogram_quantile(0.99, sum_over_time({LatencyByMethod, "@instrumentation.@name"="cloudwatch.aws/apigateway", "ApiName"="Api", "Stage"="prod", "Method"="GET", "Resource"="/app/dvla/v1/vehicle-enquiry/{reg}"}[5m]))',
    );
  });

  it("escapes quotes and backslashes in label values", () => {
    expect(
      apiLatencyQuantile(0.5, { ...target, apiName: String.raw`a"b\c` }),
    ).toContain(String.raw`"ApiName"="a\"b\\c"`);
  });
});

describe("lambdaSeriesSelector", () => {
  it("selects Lambda Duration for one stage tag", () => {
    expect(lambdaSeriesSelector("dev")).toBe(
      `{Duration, "@instrumentation.@name"="cloudwatch.aws/lambda", "@aws.tag.Stage"="dev"}`,
    );
  });
});

describe("lambdaDurationByDomain", () => {
  it("groups Duration without a Resource label by owner tag", () => {
    expect(lambdaDurationByDomain(0.95, "dev", "function-only")).toBe(
      `histogram_quantile(0.95, sum by ("@aws.tag.ResourceOwner") (sum_over_time({Duration, "@instrumentation.@name"="cloudwatch.aws/lambda", "@aws.tag.Stage"="dev", Resource=""}[5m])))`,
    );
  });
  it("leaves the Resource matcher out for all-series", () => {
    expect(lambdaDurationByDomain(0.95, "dev", "all-series")).toBe(
      `histogram_quantile(0.95, sum by ("@aws.tag.ResourceOwner") (sum_over_time({Duration, "@instrumentation.@name"="cloudwatch.aws/lambda", "@aws.tag.Stage"="dev"}[5m])))`,
    );
  });
});

describe("lambdaInvocationsByDomain", () => {
  it("includes alias and version series for all-series", () => {
    expect(lambdaInvocationsByDomain("dev", "1h", "all-series")).toBe(
      `sum by ("@aws.tag.ResourceOwner") (sum_over_time({Invocations, "@instrumentation.@name"="cloudwatch.aws/lambda", "@aws.tag.Stage"="dev"}[1h]))`,
    );
  });

  it("keeps only series without a Resource label for function-only", () => {
    expect(lambdaInvocationsByDomain("dev", "1h", "function-only")).toBe(
      `sum by ("@aws.tag.ResourceOwner") (sum_over_time({Invocations, "@instrumentation.@name"="cloudwatch.aws/lambda", "@aws.tag.Stage"="dev", Resource=""}[1h]))`,
    );
  });
});

describe("lambdaErrorsByStage", () => {
  it("groups errors in every stage by stage tag", () => {
    expect(lambdaErrorsByStage("3h", "all-series")).toBe(
      `sum by ("@aws.tag.Stage") (sum_over_time({Errors, "@instrumentation.@name"="cloudwatch.aws/lambda"}[3h]))`,
    );
  });

  it("adds the function-only matcher", () => {
    expect(lambdaErrorsByStage("3h", "function-only")).toContain(
      `"cloudwatch.aws/lambda", Resource=""}[3h]`,
    );
  });
});

describe("LAMBDA_VARIANTS", () => {
  it("lists both variants", () => {
    expect(LAMBDA_VARIANTS).toEqual(["all-series", "function-only"]);
  });
});

describe("metricsInsightsInvocationsByDomain", () => {
  it("filters on the stage tag and groups by owner tag", () => {
    expect(metricsInsightsInvocationsByDomain("dev")).toBe(
      `SELECT SUM(Invocations) FROM SCHEMA("AWS/Lambda", FunctionName) WHERE tag.Stage = 'dev' GROUP BY tag.ResourceOwner`,
    );
  });

  it("doubles single quotes in the stage", () => {
    expect(metricsInsightsInvocationsByDomain("o'brien")).toContain(
      "tag.Stage = 'o''brien'",
    );
  });
});
