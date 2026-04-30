import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ArtillerySummary {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
}

interface ArtilleryReport {
  aggregate: {
    counters: Record<string, number>;
    rates: Record<string, number>;
    summaries: Record<string, ArtillerySummary>;
    duration: number;
    firstMetricAt: number;
    lastMetricAt: number;
  };
  config: {
    ensure?: {
      thresholds?: Record<string, number>[];
    };
  };
}

function ms(value: number): string {
  return `${Math.round(value)}ms`;
}

function statusClass(p95: number, threshold: number): string {
  return p95 <= threshold ? "pass" : "fail";
}

function codeClass(code: string): string {
  if (code.startsWith("2")) return "pass";
  if (code.startsWith("4") || code.startsWith("5")) return "fail";
  return "";
}

function buildCard(name: string, report: ArtilleryReport): string {
  const { counters, rates, summaries, duration } = report.aggregate;
  const rt = summaries["http.response_time"] ?? ({} as ArtillerySummary);
  const requests = counters["http.requests"] ?? 0;
  const responses = counters["http.responses"] ?? 0;
  const errors = Object.entries(counters)
    .filter(([k]) => k.startsWith("http.codes.4") || k.startsWith("http.codes.5") || k.startsWith("errors."))
    .reduce((sum, [, v]) => sum + v, 0);
  const errorRate = responses > 0 ? ((errors / responses) * 100).toFixed(2) : "0.00";
  const rps = (rates["http.request_rate"] ?? 0).toFixed(1);

  const p95ThresholdObj = report.config.ensure?.thresholds?.find(t =>
    Object.keys(t).some(k => k.includes("p95"))
  );

  const p95Threshold = p95ThresholdObj
    ? Object.values(p95ThresholdObj)[0]
    : 1000;

  const p95Class = statusClass(rt.p95, p95Threshold);

  const statusCodes = Object.entries(counters)
    .filter(([k]) => k.startsWith("http.codes."))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const code = k.replace("http.codes.", "");
      return `<tr class="${codeClass(code)}"><td>HTTP ${code}</td><td>${v}</td></tr>`;
    })
    .join("");

  const engineErrors = Object.entries(counters)
    .filter(([k]) => k.startsWith("errors."))
    .map(([k, v]) => `<tr class="fail"><td>${k.replace("errors.", "error: ")}</td><td>${v}</td></tr>`)
    .join("");

  return `
    <div class="card">
      <h2>${name}</h2>
      <p class="meta">Duration: ${duration}s &nbsp;|&nbsp; Requests: ${requests} &nbsp;|&nbsp; RPS: ${rps}</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Min</td><td>${ms(rt.min)}</td></tr>
          <tr><td>Median (p50)</td><td>${ms(rt.p50)}</td></tr>
          <tr><td>p75</td><td>${ms(rt.p75)}</td></tr>
          <tr class="${p95Class}"><td>p95</td><td>${ms(rt.p95)}</td></tr>
          <tr><td>p99</td><td>${ms(rt.p99)}</td></tr>
          <tr><td>Max</td><td>${ms(rt.max)}</td></tr>
          <tr><td>Error rate</td><td>${errorRate}%</td></tr>
        </tbody>
      </table>
      <h3>Response codes</h3>
      <table>
        <thead><tr><th>Code</th><th>Count</th></tr></thead>
        <tbody>${statusCodes}${engineErrors || ""}</tbody>
      </table>
    </div>`;
}

function buildHtml(cards: string[], generatedAt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Artillery Performance Report</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; padding: 2rem; color: #222; }
    h1 { margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .cards { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.1); min-width: 280px; }
    .card h2 { margin-top: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #444; }
    .card .meta { margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    td { padding: 0.4rem 0.5rem; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    tr.pass td:last-child { color: #16a34a; font-weight: 600; }
    tr.fail td:last-child { color: #dc2626; font-weight: 600; }
    .card h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 1rem 0 0.5rem; }
  </style>
</head>
<body>
  <h1>Artillery Performance Report</h1>
  <p class="meta">Generated: ${generatedAt}</p>
  <div class="cards">${cards.join("")}</div>
</body>
</html>`;
}

const resultsDir = resolve(__dirname, "results");
const files = readdirSync(resultsDir).filter(
  (f) => f.endsWith(".json") && !f.includes("combined"),
);

if (files.length === 0) {
  console.error("No JSON result files found in results/");
  process.exit(1);
}

const cards = files.map((file) => {
  const raw = readFileSync(resolve(resultsDir, file), "utf-8");
  const report: ArtilleryReport = JSON.parse(raw);
  const name = basename(file, ".json");
  return buildCard(name, report);
});

const out = resolve(resultsDir, "combined-report.html");
writeFileSync(out, buildHtml(cards, new Date().toISOString()));
console.log(`Report written to ${out}`);
