import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
  type ResultField,
} from "@aws-sdk/client-cloudwatch-logs";
import { LambdaClient } from "@aws-sdk/client-lambda";

import {
  coldStartStackName,
  getLogGroups,
  listStackFunctions,
} from "./lib/coldStart";

const QUERY = `filter @type = "REPORT"
| stats count() as invocations,
        sum(ispresent(@initDuration)) as coldStarts,
        pct(@initDuration, 50) as p50InitMs,
        pct(@initDuration, 90) as p90InitMs,
        pct(@initDuration, 99) as p99InitMs,
        max(@initDuration) as maxInitMs
        by @log`;

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function runQuery(
  logs: CloudWatchLogsClient,
  logGroups: string[],
  startTime: number,
  endTime: number,
): Promise<ResultField[][]> {
  const { queryId } = await logs.send(
    new StartQueryCommand({
      logGroupNames: logGroups,
      startTime,
      endTime,
      queryString: QUERY,
    }),
  );

  if (!queryId) {
    throw new Error("CloudWatch Logs Insights did not return a query id");
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { status, results } = await logs.send(
      new GetQueryResultsCommand({ queryId }),
    );

    if (status === "Complete") {
      return results ?? [];
    }

    if (status === "Failed" || status === "Cancelled" || status === "Timeout") {
      throw new Error(`CloudWatch Logs Insights query ${status}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for CloudWatch Logs Insights results");
}

function toRow(fields: ResultField[]): Record<string, string> {
  return Object.fromEntries(
    fields
      .filter((field) => field.field && field.field !== "@ptr")
      .map((field) => [field.field as string, field.value ?? ""]),
  );
}

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const region = process.env.AWS_REGION ?? "eu-west-2";
  const minutes = Number(process.env.MINUTES ?? "60");
  const stackName = process.env.STACK ?? coldStartStackName(stage);

  const cfn = new CloudFormationClient({ region });
  const lambda = new LambdaClient({ region });
  const logs = new CloudWatchLogsClient({ region });

  const functionNames = await listStackFunctions(cfn, stackName);
  const logGroups = await getLogGroups(lambda, functionNames);

  if (logGroups.length === 0) {
    throw new Error(`No log groups found for stack "${stackName}"`);
  }

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - minutes * 60;

  console.log(
    `Cold start metrics for "${stackName}" over the last ${minutes} minute(s):\n`,
  );

  const results = await runQuery(logs, logGroups, startTime, endTime);

  if (results.length === 0) {
    console.log(
      "No REPORT lines in the window. Reset the functions, make a request, then re-run.",
    );
    return;
  }

  console.table(results.map(toRow));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
