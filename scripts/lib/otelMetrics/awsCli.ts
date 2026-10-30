import { execFileSync } from "node:child_process";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Credentials {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken?: string;
}

const MAX_BUFFER = 512 * 1024 * 1024;

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const stderr = (error as { stderr?: unknown }).stderr;
  const detail =
    typeof stderr === "string" || Buffer.isBuffer(stderr)
      ? String(stderr).trim()
      : "";
  return detail || error.message;
}

function run(command: string, args: string[], input?: string): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: MAX_BUFFER,
  });
}

export function tryRun(
  command: string,
  args: string[],
  input?: string,
): Result<string> {
  try {
    return { ok: true, value: run(command, args, input) };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export function awsJson<T>(region: string, args: string[]): Result<T> {
  const result = tryRun("aws", [
    ...args,
    "--region",
    region,
    "--output",
    "json",
    "--no-cli-pager",
  ]);
  if (!result.ok) return result;
  const output = result.value.trim();
  return { ok: true, value: (output ? JSON.parse(output) : {}) as T };
}

export function exportCredentials(): Result<Credentials> {
  const result = tryRun("aws", [
    "configure",
    "export-credentials",
    "--format",
    "process",
  ]);
  if (!result.ok) return result;
  return { ok: true, value: JSON.parse(result.value) as Credentials };
}

export function firstLine(command: string, args: string[]): string {
  const result = tryRun(command, args);
  return result.ok
    ? (result.value.split("\n")[0] ?? "").trim()
    : `unavailable: ${result.error.split("\n")[0] ?? ""}`;
}
