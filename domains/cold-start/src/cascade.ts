import { logger } from "@flex/logging";
import status from "http-status";

const MODULE_LOADED_AT = Date.now();
const LOG_MARKER = "cold-start-lab";

let warmInvocations = 0;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

interface IntegrationResultLike {
  readonly ok: boolean;
  readonly data?: unknown;
  readonly error?: unknown;
}

interface RunCascadeInput {
  readonly delays: readonly number[];
  readonly hop: number;
  readonly callNext: (
    query: Record<string, string>,
  ) => Promise<IntegrationResultLike>;
}

export async function runCascade({ delays, hop, callNext }: RunCascadeInput) {
  const [waitMs = 0, ...rest] = delays;

  const cold = warmInvocations === 0;
  warmInvocations += 1;
  const initAgeMs = Date.now() - MODULE_LOADED_AT;

  logger.info("cascade hop entered", {
    marker: LOG_MARKER,
    phase: "enter",
    hop,
    cold,
    waitMs,
    remaining: rest.length,
    initAgeMs,
  });

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  let next: unknown = null;

  if (rest.length > 0) {
    logger.info("cascade calling next", {
      marker: LOG_MARKER,
      phase: "call-next",
      hop,
      nextHop: hop + 1,
      remaining: rest.length,
    });

    const result = await callNext({
      delays: rest.join(","),
      hop: String(hop + 1),
    });

    next = result.ok ? result.data : { error: result.error };
  }

  logger.info("cascade hop complete", {
    marker: LOG_MARKER,
    phase: "complete",
    hop,
    cold,
    waitMs,
  });

  return {
    status: status.OK,
    data: { hop, cold, waitedMs: waitMs, initAgeMs, next },
  };
}
