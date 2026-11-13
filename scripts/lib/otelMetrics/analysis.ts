import type { MetricSelector } from "./namespaces";

export const PRICE_PER_GB_USD = 0.5;
export const MINUTES_PER_MONTH = 60 * 24 * 30;

export interface CostEstimate {
  series: number;
  bytesPerPoint: number;
  pointsPerMonth: number;
  gbPerMonth: number;
  usdPerMonth: number;
}

export interface TimedValue {
  timestamp: number;
  value: number;
}

export interface ComparisonRow {
  timestamp: string;
  classic: number;
  promql: number;
  difference: number;
}

export interface ComparisonStats {
  matched: number;
  classicOnly: number;
  promqlOnly: number;
  medianAbsoluteDifference?: number;
  maxAbsoluteDifference?: number;
  medianRelativeDifference?: number;
}

export function estimateMonthlyCost(
  series: number,
  bytesPerPoint: number,
): CostEstimate {
  const pointsPerMonth = series * MINUTES_PER_MONTH;
  const gbPerMonth = (pointsPerMonth * bytesPerPoint) / 1e9;
  return {
    series,
    bytesPerPoint,
    pointsPerMonth,
    gbPerMonth,
    usdPerMonth: gbPerMonth * PRICE_PER_GB_USD,
  };
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle];
}

function selectorKey(selector: MetricSelector): string {
  return `${selector.Namespace}:${[...(selector.MetricNames ?? [])].sort().join(",")}`;
}

export function sameFilters(
  sent: MetricSelector[],
  returned: MetricSelector[] | undefined,
): boolean {
  const a = sent.map(selectorKey).sort();
  const b = (returned ?? []).map(selectorKey).sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export function promqlPoints(values: [number, string][]): TimedValue[] {
  return values
    .map(([timestamp, value]) => ({ timestamp, value: Number(value) }))
    .filter((point) => Number.isFinite(point.value));
}

export function compareSeries(
  classic: TimedValue[],
  promql: TimedValue[],
  promqlShiftSeconds: number,
): { rows: ComparisonRow[]; stats: ComparisonStats } {
  const promqlByTime = new Map(
    promql.map((point) => [point.timestamp - promqlShiftSeconds, point.value]),
  );
  const matchedClassic = classic.filter((point) =>
    promqlByTime.has(point.timestamp),
  );
  const rows = matchedClassic.map((point) => {
    const promqlValue = promqlByTime.get(point.timestamp) ?? Number.NaN;
    return {
      timestamp: new Date(point.timestamp * 1000).toISOString(),
      classic: point.value,
      promql: promqlValue,
      difference: promqlValue - point.value,
    };
  });
  const absolute = rows.map((row) => Math.abs(row.difference));
  const relative = rows
    .filter((row) => row.classic !== 0)
    .map((row) => Math.abs(row.difference) / Math.abs(row.classic));
  return {
    rows,
    stats: {
      matched: rows.length,
      classicOnly: classic.length - rows.length,
      promqlOnly: promql.length - rows.length,
      medianAbsoluteDifference: median(absolute),
      maxAbsoluteDifference: absolute.length
        ? Math.max(...absolute)
        : undefined,
      medianRelativeDifference: median(relative),
    },
  };
}

export function labelBytes(labels: Record<string, string>): number {
  return Object.entries(labels).reduce(
    (total, [name, value]) =>
      total + Buffer.byteLength(name) + Buffer.byteLength(value),
    0,
  );
}

export function tagLabelNames(labelNames: string[]): string[] {
  return labelNames.filter((name) => name.startsWith("@aws.tag.")).sort();
}

export function countBy<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, number> {
  return items.reduce(
    (counts, item) => counts.set(key(item), (counts.get(key(item)) ?? 0) + 1),
    new Map<string, number>(),
  );
}

export function sumValues(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function formatNumber(value: number | undefined, digits = 2): string {
  return value === undefined || !Number.isFinite(value)
    ? "n/a"
    : value.toFixed(digits);
}
