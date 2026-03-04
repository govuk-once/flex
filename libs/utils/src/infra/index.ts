import fs from "node:fs";
import path from "node:path";

import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";

export function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;

  while (dir !== path.parse(dir).root) {
    const pnpmFile = path.join(dir, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpmFile)) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  throw new Error("Could not find pnpm-workspace.yaml file");
}

export function sanitiseStageName(value?: string) {
  if (!value) return undefined;

  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 12);
}

function toSafeMessage(err: unknown) {
  const e = err as {
    name?: string;
    message?: string;
    $metadata?: { requestId?: string };
  };
  const requestId = e.$metadata?.requestId
    ? ` requestId=${e.$metadata.requestId}`
    : "";
  const name = e.name ?? "CloudFormationError";
  const message = e.message ?? "Failed to query stack outputs";
  return `${name}: ${message}${requestId}`;
}

export async function getStackOutputs(stackName: string) {
  const client = new CloudFormationClient();
  const command = new DescribeStacksCommand({
    StackName: stackName,
  });

  try {
    const { Stacks } = await client.send(command);

    if (!Stacks?.[0]?.Outputs) {
      throw new Error(`No outputs found in stack: "${stackName}"`);
    }

    return Object.fromEntries(
      Stacks[0].Outputs.map((o) => [o.OutputKey ?? "", o.OutputValue ?? ""]),
    );
  } catch (error) {
    // Important: throw a fresh Error so Vitest serializes only safe text.
    throw new Error(
      `Unable to resolve CloudFormation outputs for stack "${stackName}". ${toSafeMessage(error)}`,
    );
  }
}
