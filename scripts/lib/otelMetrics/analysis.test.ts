import { describe, expect, it } from "vitest";

import {
  compareSeries,
  countBy,
  estimateMonthlyCost,
  formatNumber,
  labelBytes,
  median,
  MINUTES_PER_MONTH,
  PRICE_PER_GB_USD,
  promqlPoints,
  sameFilters,
  sumValues,
  tagLabelNames,
} from "./analysis";

describe("estimateMonthlyCost", () => {
  it("charges one data point per series per minute at the per-GB price", () => {
    expect(estimateMonthlyCost(1000, 500)).toEqual({
      series: 1000,
      bytesPerPoint: 500,
      pointsPerMonth: 43_200_000,
      gbPerMonth: 21.6,
      usdPerMonth: 10.8,
    });
  });

  it("uses a 30-day month and $0.50 per GB", () => {
    expect(MINUTES_PER_MONTH).toBe(43_200);
    expect(PRICE_PER_GB_USD).toBe(0.5);
  });

  it("returns zero cost for zero series", () => {
    expect(estimateMonthlyCost(0, 1000)).toMatchObject({
      pointsPerMonth: 0,
      gbPerMonth: 0,
      usdPerMonth: 0,
    });
  });
});

describe("median", () => {
  it("returns undefined for an empty list", () => {
    expect(median([])).toBeUndefined();
  });

  it("returns the middle value of an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("returns the mean of the two middle values of an even-length list", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("sorts numerically rather than as strings", () => {
    expect(median([10, 9, 100])).toBe(10);
  });

  it("does not reorder the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("sameFilters", () => {
  it("matches the same selectors in a different order", () => {
    expect(
      sameFilters(
        [{ Namespace: "AWS/Lambda" }, { Namespace: "AWS/ApiGateway" }],
        [{ Namespace: "AWS/ApiGateway" }, { Namespace: "AWS/Lambda" }],
      ),
    ).toBe(true);
  });

  it("matches metric names in a different order", () => {
    expect(
      sameFilters(
        [{ Namespace: "AWS/Lambda", MetricNames: ["Errors", "Duration"] }],
        [{ Namespace: "AWS/Lambda", MetricNames: ["Duration", "Errors"] }],
      ),
    ).toBe(true);
  });

  it("treats no returned filters as an empty list", () => {
    expect(sameFilters([], undefined)).toBe(true);
  });

  it("rejects a missing selector", () => {
    expect(
      sameFilters(
        [{ Namespace: "AWS/Lambda" }, { Namespace: "AWS/ApiGateway" }],
        [{ Namespace: "AWS/Lambda" }],
      ),
    ).toBe(false);
  });

  it("rejects filters returned when none were sent", () => {
    expect(sameFilters([], [{ Namespace: "AWS/Lambda" }])).toBe(false);
  });

  it("rejects a selector narrowed to metric names", () => {
    expect(
      sameFilters(
        [{ Namespace: "AWS/Lambda" }],
        [{ Namespace: "AWS/Lambda", MetricNames: ["Duration"] }],
      ),
    ).toBe(false);
  });
});

describe("promqlPoints", () => {
  it("converts string values to numbers", () => {
    expect(
      promqlPoints([
        [1000, "1.5"],
        [1300, "2"],
      ]),
    ).toEqual([
      { timestamp: 1000, value: 1.5 },
      { timestamp: 1300, value: 2 },
    ]);
  });

  it("drops NaN and infinite values", () => {
    expect(
      promqlPoints([
        [1000, "NaN"],
        [1300, "+Inf"],
        [1600, "3"],
      ]),
    ).toEqual([{ timestamp: 1600, value: 3 }]);
  });
});

describe("compareSeries", () => {
  const classic = [
    { timestamp: 100, value: 1 },
    { timestamp: 400, value: 2 },
    { timestamp: 700, value: 4 },
  ];

  it("pairs points after moving PromQL timestamps back by the shift", () => {
    const promql = [
      { timestamp: 400, value: 1.5 },
      { timestamp: 700, value: 2 },
      { timestamp: 1300, value: 9 },
    ];
    expect(compareSeries(classic, promql, 300)).toEqual({
      rows: [
        {
          timestamp: "1970-01-01T00:01:40.000Z",
          classic: 1,
          promql: 1.5,
          difference: 0.5,
        },
        {
          timestamp: "1970-01-01T00:06:40.000Z",
          classic: 2,
          promql: 2,
          difference: 0,
        },
      ],
      stats: {
        matched: 2,
        classicOnly: 1,
        promqlOnly: 1,
        medianAbsoluteDifference: 0.25,
        maxAbsoluteDifference: 0.5,
        medianRelativeDifference: 0.25,
      },
    });
  });

  it("pairs on equal timestamps with no shift", () => {
    const { stats } = compareSeries(classic, classic, 0);
    expect(stats).toEqual({
      matched: 3,
      classicOnly: 0,
      promqlOnly: 0,
      medianAbsoluteDifference: 0,
      maxAbsoluteDifference: 0,
      medianRelativeDifference: 0,
    });
  });

  it("leaves the differences undefined when nothing matches", () => {
    const { rows, stats } = compareSeries(
      classic,
      [{ timestamp: 5, value: 1 }],
      0,
    );
    expect(rows).toEqual([]);
    expect(stats).toEqual({
      matched: 0,
      classicOnly: 3,
      promqlOnly: 1,
      medianAbsoluteDifference: undefined,
      maxAbsoluteDifference: undefined,
      medianRelativeDifference: undefined,
    });
  });

  it("leaves zero classic values out of the relative difference", () => {
    const { stats } = compareSeries(
      [
        { timestamp: 100, value: 0 },
        { timestamp: 400, value: 10 },
      ],
      [
        { timestamp: 100, value: 5 },
        { timestamp: 400, value: 11 },
      ],
      0,
    );
    expect(stats.maxAbsoluteDifference).toBe(5);
    expect(stats.medianRelativeDifference).toBeCloseTo(0.1);
  });
});

describe("labelBytes", () => {
  it("adds the UTF-8 length of every name and value", () => {
    expect(labelBytes({ ab: "c", é: "x" })).toBe(6);
  });

  it("returns zero for no labels", () => {
    expect(labelBytes({})).toBe(0);
  });
});

describe("tagLabelNames", () => {
  it("keeps only resource tag labels, sorted", () => {
    expect(
      tagLabelNames([
        "@aws.tag.Stage",
        "FunctionName",
        "@aws.tag.Owner",
        "@resource.cloud.resource_id",
      ]),
    ).toEqual(["@aws.tag.Owner", "@aws.tag.Stage"]);
  });
});

describe("countBy", () => {
  it("counts items by key", () => {
    expect(countBy(["dvla", "udp", "dvla"], (item) => item)).toEqual(
      new Map([
        ["dvla", 2],
        ["udp", 1],
      ]),
    );
  });

  it("returns an empty map for no items", () => {
    expect(countBy([], String).size).toBe(0);
  });
});

describe("sumValues", () => {
  it("adds the values", () => {
    expect(sumValues([1, 2, 3.5])).toBe(6.5);
  });

  it("returns zero for no values", () => {
    expect(sumValues([])).toBe(0);
  });
});

describe("formatNumber", () => {
  it("rounds to two places by default", () => {
    expect(formatNumber(1.236)).toBe("1.24");
  });

  it("rounds to the given number of places", () => {
    expect(formatNumber(1234.5, 0)).toBe("1235");
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns n/a for %s",
    (value) => {
      expect(formatNumber(value)).toBe("n/a");
    },
  );
});
