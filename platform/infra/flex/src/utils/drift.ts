export interface PropertyDifference {
  propertyPath: string;
  expected?: string;
  actual?: string;
}

export interface ResourceDrift {
  logicalId: string;
  resourceType: string;
  status: string;
  differences: PropertyDifference[];
}

export interface DriftAllowlistEntry {
  /** Stack name without the `${stage}-` prefix, e.g. "FlexPlatform" */
  stack: string;
  logicalId: string;
  propertyPath: string;
  reason: string;
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
): boolean {
  return allowlist.some(
    (entry) =>
      entry.stack === stack &&
      entry.logicalId === drift.logicalId &&
      entry.propertyPath === difference.propertyPath,
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
): ResourceDrift[] {
  return drifts.flatMap((drift) => {
    if (drift.status !== "MODIFIED") return [drift];

    const differences = drift.differences.filter(
      (difference) => !isAllowed(stack, drift, difference, allowlist),
    );

    return differences.length > 0 || drift.differences.length === 0
      ? [{ ...drift, differences }]
      : [];
  });
}
