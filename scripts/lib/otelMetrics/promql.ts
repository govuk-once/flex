import type { Credentials, Result } from "./awsCli";
import { tryRun } from "./awsCli";

export type PromqlPath = "query" | "query_range" | "series" | "labels";

export interface PromqlResponse {
  status: string;
  data?: unknown;
  errorType?: string;
  error?: string;
  warnings?: string[];
}

export interface PromqlReply {
  httpStatus: number;
  body?: PromqlResponse;
  raw: string;
}

export interface MatrixSeries {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface VectorSample {
  metric: Record<string, string>;
  value: [number, string];
}

const STATUS_MARKER = "\n__HTTP_STATUS__:";

function option(name: string, value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, String.raw`\"`)
    .replace(/\n/g, String.raw`\n`);
  return `${name} = "${escaped}"`;
}

export function curlConfig(
  region: string,
  credentials: Credentials,
  path: PromqlPath,
  params: [string, string][],
): string {
  const url = "https://monitoring." + region + ".amazonaws.com/api/v1/" + path;
  const signing = "aws:amz:" + region + ":monitoring";
  const user = credentials.AccessKeyId + ":" + credentials.SecretAccessKey;
  const tokenHeaders = credentials.SessionToken
    ? ["x-amz-security-token: " + credentials.SessionToken]
    : [];
  const lines = [
    option("url", url),
    option("aws-sigv4", signing),
    option("user", user),
    ...tokenHeaders.map((header) => option("header", header)),
    option("header", "Content-Type: application/x-www-form-urlencoded"),
    option("request", "POST"),
    ...(params.length === 0 ? [option("data", "")] : []),
    ...params.map(([name, value]) =>
      option("data-urlencode", name + "=" + value),
    ),
    option("write-out", STATUS_MARKER + "%{http_code}"),
    "silent",
    "show-error",
  ];
  return lines.join("\n") + "\n";
}

function parseBody(raw: string): PromqlResponse | undefined {
  try {
    return JSON.parse(raw) as PromqlResponse;
  } catch {
    return undefined;
  }
}

export function promql(
  region: string,
  credentials: Credentials,
  path: PromqlPath,
  params: [string, string][],
): Result<PromqlReply> {
  const result = tryRun(
    "curl",
    ["-K", "-"],
    curlConfig(region, credentials, path, params),
  );
  if (!result.ok) return result;
  const markerAt = result.value.lastIndexOf(STATUS_MARKER);
  const raw = markerAt === -1 ? result.value : result.value.slice(0, markerAt);
  const httpStatus =
    markerAt === -1
      ? 0
      : Number(result.value.slice(markerAt + STATUS_MARKER.length));
  return { ok: true, value: { httpStatus, body: parseBody(raw), raw } };
}

export function isSuccess(reply: Result<PromqlReply>): boolean {
  return (
    reply.ok &&
    reply.value.httpStatus === 200 &&
    reply.value.body?.status === "success"
  );
}

export function matrixOf(reply: Result<PromqlReply>): MatrixSeries[] {
  if (!isSuccess(reply) || !reply.ok) return [];
  const data = reply.value.body?.data as
    | { result?: MatrixSeries[] }
    | undefined;
  return data?.result ?? [];
}

export function vectorOf(reply: Result<PromqlReply>): VectorSample[] {
  if (!isSuccess(reply) || !reply.ok) return [];
  const data = reply.value.body?.data as
    | { result?: VectorSample[] }
    | undefined;
  return data?.result ?? [];
}

export function listOf<T>(reply: Result<PromqlReply>): T[] {
  if (!isSuccess(reply) || !reply.ok) return [];
  const data = reply.value.body?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export function describeReply(reply: Result<PromqlReply>): string {
  if (!reply.ok) return `curl failed: ${reply.error}`;
  const { httpStatus, body, raw } = reply.value;
  if (isSuccess(reply)) {
    const warnings = body?.warnings?.length
      ? ` (warnings: ${body.warnings.join("; ")})`
      : "";
    return `HTTP ${String(httpStatus)} success${warnings}`;
  }
  const detail = body?.error ?? raw.slice(0, 300);
  return `HTTP ${String(httpStatus)} ${body?.errorType ?? "error"}: ${detail}`;
}
