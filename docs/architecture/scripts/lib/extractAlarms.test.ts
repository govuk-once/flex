import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractAlarms } from "./extractAlarms";

/** Writes one construct file into a throwaway directory and reads the alarms back out. */
function parse(source: string) {
  const root = mkdtempSync(path.join(tmpdir(), "alarms-"));
  writeFileSync(path.join(root, "example.ts"), source);
  return extractAlarms(root, ".");
}

describe("extractAlarms", () => {
  it("reads a plain new Alarm(), its threshold and its topic", () => {
    const [alarm, ...rest] = parse(`
      export class Example {
        constructor() {
          this.errors = new Alarm(this, "Errors", {
            alarmName: \`\${prefix}-errors\`,
            metric: new Metric({ namespace: "AWS/Lambda", metricName: "Errors", statistic: Stats.SUM }),
            threshold: 0,
            evaluationPeriods: 1,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: TreatMissingData.NOT_BREACHING,
          });
          this.errors.addAlarmAction(criticalAction);
        }
      }
    `);
    expect(rest).toEqual([]);
    expect(alarm).toMatchObject({
      id: "Errors",
      alarmName: "${prefix}-errors",
      metric: "Errors",
      statistic: "sum",
      threshold: "0",
      evaluationPeriods: "1",
      comparison: "GREATER_THAN_THRESHOLD",
      treatMissingData: "NOT_BREACHING",
      action: "criticalAction",
    });
  });

  it("reads the metric.createAlarm() form as well as the constructor form", () => {
    const ids = parse(`
      const a = new Alarm(this, "Direct", { threshold: 1 });
      this.b = gated.createAlarm(this, "ViaMetric", { threshold: 2 });
    `).map((x) => x.id);
    expect(ids).toEqual(["Direct", "ViaMetric"]);
  });

  it("reads any constructor whose name ends in Alarm", () => {
    const ids = parse(`
      new Alarm(this, "Plain", {});
      new CfnAlarm(this, "Cfn", {});
      new AnomalyDetectionAlarm(this, "Anomaly", { stdDevs: 2 });
    `).map((x) => x.id);
    expect(ids).toEqual(["Plain", "Cfn", "Anomaly"]);
  });

  it("resolves a threshold written as a named constant", () => {
    const [alarm] = parse(`
      const latencyMs = 3000;
      new Alarm(this, "Latency", { threshold: latencyMs });
    `);
    expect(alarm?.threshold).toBe("3000");
  });

  it("folds arithmetic over a named constant", () => {
    const [alarm] = parse(`
      const percent = 5;
      new Alarm(this, "Rate", { threshold: percent / 100 });
    `);
    expect(alarm?.threshold).toBe("0.05");
  });

  it("leaves a threshold it cannot resolve exactly as the source wrote it", () => {
    const [alarm] = parse(`
      new Alarm(this, "Duration", { threshold: timeout.toSeconds() * 0.8 });
    `);
    expect(alarm?.threshold).toBe("timeout.toSeconds() * 0.8");
  });

  it("ties an alarm to the topic assigned on a later line", () => {
    const [alarm] = parse(`
      this.spike = new Alarm(this, "Spike", {});
      this.spike.addAlarmAction(warningAction);
    `);
    expect(alarm?.action).toBe("warningAction");
  });

  it("ignores test files next to the constructs", () => {
    const root = mkdtempSync(path.join(tmpdir(), "alarms-"));
    writeFileSync(path.join(root, "real.ts"), `new Alarm(this, "Real", {});`);
    writeFileSync(
      path.join(root, "real.test.ts"),
      `new Alarm(this, "Fake", {});`,
    );
    expect(extractAlarms(root, ".").map((x) => x.id)).toEqual(["Real"]);
  });

  it("returns nothing for a file that creates no alarms", () => {
    expect(parse(`export const x = 1;`)).toEqual([]);
  });
});
