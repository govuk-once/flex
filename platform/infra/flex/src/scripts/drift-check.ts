/**
 * Pre-deploy drift check: runs CloudFormation drift detection on every stack
 * in cdk.out and exits 1 when a stack has drifted, or is in a status that
 * stops `cdk deploy` from updating it. By-design drift is listed in
 * src/drift-allowlist.ts.
 *
 * Usage: cdk synth --quiet && tsx src/scripts/drift-check.ts
 */
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import {
  CloudFormationClient,
  DescribeStackDriftDetectionStatusCommand,
  DescribeStacksCommand,
  DetectStackDriftCommand,
  paginateDescribeStackResourceDrifts,
} from "@aws-sdk/client-cloudformation";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { getEnvConfig } from "@flex/utils";

import { driftAllowlist } from "../drift-allowlist";
import {
  filterDrift,
  fromDetection,
  isBlockingStackStatus,
  type ResourceDrift,
  unprefixedStackName,
} from "../utils/drift";

interface StackArtifact {
  type: string;
  environment?: string;
  properties?: { stackName?: string; lookupRole?: { arn?: string } };
}

const { stage } = getEnvConfig();

// CloudFormation throttles drift detection hard ("Rate exceeded"), so only a
// few stacks are checked at a time and polling is gentle
const STACK_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 10_000;
// Drift detection on our largest stacks takes a few minutes
const DETECTION_TIMEOUT_MS = 10 * 60_000;

const clients = new Map<string, CloudFormationClient>();

function parseEnvironment(environment = "") {
  const [, account = "", region = ""] =
    /^aws:\/\/([^/]+)\/(.+)$/.exec(environment) ?? [];
  return { account, region };
}

// Each stack is checked with its CDK lookup role, which has read-only access.
// Stacks in the same account and region share a client, so they share its
// adaptive retry rate limiter and assume the role once.
function clientFor(environment = "", lookupRoleArn?: string) {
  const { account, region } = parseEnvironment(environment);
  const roleArn = lookupRoleArn
    ?.replace("${AWS::Partition}", "aws")
    .replace("${AWS::AccountId}", account);

  const key = `${region}|${roleArn ?? ""}`;
  let client = clients.get(key);
  if (!client) {
    client = new CloudFormationClient({
      region: region || undefined,
      retryMode: "adaptive",
      maxAttempts: 10,
      credentials: roleArn
        ? fromTemporaryCredentials({
            params: { RoleArn: roleArn, RoleSessionName: "flex-drift-check" },
            clientConfig: { region: region || undefined },
          })
        : undefined,
    });
    clients.set(key, client);
  }
  return client;
}

/** Runs fn over items with at most `limit` calls in flight, keeping order */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    const index = next++;
    if (index >= items.length) return;
    results[index] = await fn(items[index] as T);
    return worker();
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

// DETECTION_FAILED still returns results for the resources it could check.
// Resolves to the time the detection started.
async function waitForDetection(
  client: CloudFormationClient,
  StackName: string,
  StackDriftDetectionId: string | undefined,
  deadline: number,
): Promise<Date | undefined> {
  const { DetectionStatus, Timestamp } = await client.send(
    new DescribeStackDriftDetectionStatusCommand({ StackDriftDetectionId }),
  );
  if (DetectionStatus !== "DETECTION_IN_PROGRESS") return Timestamp;
  if (Date.now() >= deadline) {
    throw new Error(
      `${StackName}: drift detection did not finish within ${String(DETECTION_TIMEOUT_MS / 60_000)} minutes`,
    );
  }
  await sleep(POLL_INTERVAL_MS);
  return waitForDetection(client, StackName, StackDriftDetectionId, deadline);
}

async function detectDrift(client: CloudFormationClient, StackName: string) {
  const { StackDriftDetectionId } = await client.send(
    new DetectStackDriftCommand({ StackName }),
  );

  const detectedAt = await waitForDetection(
    client,
    StackName,
    StackDriftDetectionId,
    Date.now() + DETECTION_TIMEOUT_MS,
  );

  const drifts: ResourceDrift[] = [];
  for await (const page of paginateDescribeStackResourceDrifts(
    { client },
    { StackName, StackResourceDriftStatusFilters: ["MODIFIED", "DELETED"] },
  )) {
    for (const drift of page.StackResourceDrifts ?? []) {
      drifts.push({
        logicalId: drift.LogicalResourceId ?? "",
        physicalId: drift.PhysicalResourceId,
        resourceType: drift.ResourceType ?? "",
        status: drift.StackResourceDriftStatus ?? "",
        differences: (drift.PropertyDifferences ?? []).map((difference) => ({
          propertyPath: difference.PropertyPath ?? "",
          expected: difference.ExpectedValue,
          actual: difference.ActualValue,
        })),
        timestamp: drift.Timestamp,
      });
    }
  }
  return fromDetection(drifts, detectedAt);
}

/** Returns the problems found in one stack, empty when it is safe to deploy */
async function checkStack(artifact: StackArtifact, stackName: string) {
  const client = clientFor(
    artifact.environment,
    artifact.properties?.lookupRole?.arn,
  );

  const { Stacks } = await client
    .send(new DescribeStacksCommand({ StackName: stackName }))
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return { Stacks: [] };
      }
      throw error;
    });

  const status = Stacks?.[0]?.StackStatus;
  if (!status) return [];
  if (isBlockingStackStatus(status)) {
    return [`stack is ${status}, so cdk deploy cannot update it`];
  }

  const drifts = filterDrift(
    unprefixedStackName(stackName, stage),
    await detectDrift(client, stackName),
    driftAllowlist,
    parseEnvironment(artifact.environment),
  );

  return drifts.flatMap(({ status, resourceType, logicalId, differences }) => [
    `[${status}] ${resourceType} ${logicalId}`,
    ...differences.map(
      ({ propertyPath, expected = "null", actual = "null" }) =>
        `    ${propertyPath}\n      expected: ${expected}\n      actual:   ${actual}`,
    ),
  ]);
}

async function main() {
  const { artifacts = {} } = JSON.parse(
    readFileSync("cdk.out/manifest.json", "utf8"),
  ) as { artifacts?: Record<string, StackArtifact> };

  const stacks = Object.entries(artifacts)
    .filter(([, artifact]) => artifact.type === "aws:cloudformation:stack")
    .map(([id, artifact]) => ({
      artifact,
      stackName: artifact.properties?.stackName ?? id,
    }));

  const results = await mapWithConcurrency(
    stacks,
    STACK_CONCURRENCY,
    async ({ artifact, stackName }) => ({
      stackName,
      problems: await checkStack(artifact, stackName),
    }),
  );

  for (const { stackName, problems } of results) {
    console.log(
      problems.length === 0
        ? `${stackName}: ok`
        : [`${stackName}: FAILED`, ...problems.map((p) => `  ${p}`)].join("\n"),
    );
  }

  if (results.some(({ problems }) => problems.length > 0)) {
    console.log(
      "\nUnexpected drift. Fix the live resource or the code, or add by-design drift to src/drift-allowlist.ts.",
    );
    return 1;
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
