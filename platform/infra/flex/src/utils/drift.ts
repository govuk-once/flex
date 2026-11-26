import { isDeepStrictEqual } from "node:util";

export interface PropertyDifference {
  propertyPath: string;
  expected?: string;
  actual?: string;
}

export interface ResourceDrift {
  logicalId: string;
  /** The live resource's ID, e.g. a RestApi's API ID */
  physicalId?: string;
  resourceType: string;
  status: string;
  differences: PropertyDifference[];
}

export interface DriftAllowlistEntry {
  /** Stack name without the `${stage}-` prefix, e.g. "FlexPlatform" */
  stack: string;
  logicalId: string;
  /**
   * The exact property path, or a RegExp for a path that includes an array
   * index that can move, e.g. /^\/Rules\/\d+$/
   */
  propertyPath: string | RegExp;
  /**
   * Allows only a value that is not in the template at all (expected is
   * null) and that, parsed as JSON, contains every field given here. Fields
   * not given are ignored. Use it for entries that AWS adds to a resource,
   * such as a rule in a web ACL.
   */
  addedValue?: Record<string, unknown>;
  /**
   * Without this or addedValue, any value at propertyPath is allowed. With
   * it, the difference is allowed only when applying these rewrites to the
   * expected value gives exactly the actual value (compared as JSON when both
   * parse).
   * `from` and `to` may use {region}, {account} and {physicalId}.
   */
  expectedRewrites?: { from: string; to: string }[];
  reason: string;
}

/** Where the stack is deployed, used to fill in rewrite placeholders */
export interface DriftContext {
  region: string;
  account: string;
}

function fillPlaceholders(
  template: string,
  context: DriftContext,
  physicalId: string,
): string {
  return template
    .replaceAll("{region}", context.region)
    .replaceAll("{account}", context.account)
    .replaceAll("{physicalId}", physicalId);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function sameValue(a: string, b: string): boolean {
  if (a === b) return true;
  const parsedA = parseJson(a);
  const parsedB = parseJson(b);
  return (
    parsedA !== undefined &&
    parsedB !== undefined &&
    isDeepStrictEqual(parsedA, parsedB)
  );
}

function isAbsent(value?: string): boolean {
  return value === undefined || value === "null";
}

/**
 * True when actual has every field in pattern, with the same value. Objects
 * are compared field by field at every depth; anything else must be equal.
 */
function containsFields(pattern: unknown, actual: unknown): boolean {
  if (
    typeof pattern !== "object" ||
    pattern === null ||
    Array.isArray(pattern)
  ) {
    return isDeepStrictEqual(pattern, actual);
  }
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
    return false;
  }
  return Object.entries(pattern).every(([key, value]) =>
    containsFields(value, (actual as Record<string, unknown>)[key]),
  );
}

/**
 * True when the difference adds a value the template does not have, and
 * that value contains the entry's fields
 */
function matchesAddedValue(
  entry: DriftAllowlistEntry,
  difference: PropertyDifference,
): boolean {
  if (!entry.addedValue) return true;
  if (!isAbsent(difference.expected) || isAbsent(difference.actual)) {
    return false;
  }
  return containsFields(entry.addedValue, parseJson(difference.actual ?? ""));
}

function matchesPath(entry: DriftAllowlistEntry, propertyPath: string) {
  return typeof entry.propertyPath === "string"
    ? entry.propertyPath === propertyPath
    : entry.propertyPath.test(propertyPath);
}

/**
 * True when the entry's rewrites turn the expected value into the actual one.
 * Entries without rewrites match any value.
 */
function matchesRewrites(
  entry: DriftAllowlistEntry,
  difference: PropertyDifference,
  context: DriftContext,
  physicalId = "",
): boolean {
  if (!entry.expectedRewrites) return true;
  if (difference.expected === undefined || difference.actual === undefined) {
    return false;
  }
  if (
    !physicalId &&
    entry.expectedRewrites.some(({ to }) => to.includes("{physicalId}"))
  ) {
    return false;
  }

  const rewritten = entry.expectedRewrites.reduce(
    (value, { from, to }) =>
      value.replaceAll(
        fillPlaceholders(from, context, physicalId),
        fillPlaceholders(to, context, physicalId),
      ),
    difference.expected,
  );
  return sameValue(rewritten, difference.actual);
}

/**
 * Stack statuses that stop `cdk deploy` from updating the stack, so the
 * deploy would fail before it changes anything.
 */
export function isBlockingStackStatus(status: string): boolean {
  return (
    status.endsWith("_FAILED") ||
    status.endsWith("_IN_PROGRESS") ||
    status === "ROLLBACK_COMPLETE"
  );
}

export function unprefixedStackName(stackName: string, stage: string): string {
  const prefix = `${stage}-`;
  return stackName.startsWith(prefix)
    ? stackName.slice(prefix.length)
    : stackName;
}

function isAllowed(
  stack: string,
  drift: ResourceDrift,
  difference: PropertyDifference,
  allowlist: DriftAllowlistEntry[],
  context: DriftContext,
): boolean {
  return allowlist.some(
    (entry) =>
      entry.stack === stack &&
      entry.logicalId === drift.logicalId &&
      matchesPath(entry, difference.propertyPath) &&
      matchesAddedValue(entry, difference) &&
      matchesRewrites(entry, difference, context, drift.physicalId),
  );
}

/**
 * Removes allowlisted property differences. A resource is only dropped when
 * every one of its differences is allowlisted, and a deleted resource is
 * never dropped.
 */
export function filterDrift(
  stack: string,
  drifts: ResourceDrift[],
  allowlist: DriftAllowlistEntry[],
  context: DriftContext,
): ResourceDrift[] {
  return drifts.flatMap((drift) => {
    if (drift.status !== "MODIFIED") return [drift];

    const differences = drift.differences.filter(
      (difference) => !isAllowed(stack, drift, difference, allowlist, context),
    );

    return differences.length > 0 || drift.differences.length === 0
      ? [{ ...drift, differences }]
      : [];
  });
}
