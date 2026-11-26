import { AsyncLocalStorage } from "node:async_hooks";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const correlationStorage = new AsyncLocalStorage<string | undefined>();

/**
 * Reads the correlation id from inbound event headers, matching the header
 * name case-insensitively.
 */
export function extractCorrelationId(
  headers?: Readonly<Record<string, string | undefined>> | null,
): string | undefined {
  if (!headers) return;

  const entry = Object.entries(headers).find(
    ([name, value]) =>
      name.toLowerCase() === CORRELATION_ID_HEADER && value !== undefined,
  );

  return entry?.[1] || undefined;
}

/**
 * Runs `fn` with the given correlation id available to everything called
 * within it (including outbound `flexFetch` requests).
 */
export function runWithCorrelationId<T>(
  correlationId: string | undefined,
  fn: () => T,
): T {
  return correlationStorage.run(correlationId, fn);
}

/**
 * Returns the correlation id for the current invocation, or `undefined` when
 * called outside `runWithCorrelationId` or when no id was received.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
