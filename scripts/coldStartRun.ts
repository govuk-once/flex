import { getStackOutputs } from "@flex/utils";

import { getJwtClient } from "../tests/e2e/src/setup.global";

const DEFAULT_DELAYS = "200,200,200,200,200";
const CASCADE_PATH = "/app/cold-start/v1/cascade";

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const delays = process.env.DELAYS ?? process.argv[2] ?? DEFAULT_DELAYS;

  const { FlexApiUrl } = await getStackOutputs(`${stage}-FlexGlobal`, "us-east-1");

  if (!FlexApiUrl) {
    throw new Error(`FlexApiUrl not found in "${stage}-FlexGlobal" outputs`);
  }

  const token = await (await getJwtClient(stage)).getToken();

  const url = `${FlexApiUrl}${CASCADE_PATH}?delays=${encodeURIComponent(delays)}`;
  console.log(`GET ${url}\n`);

  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();
  const elapsedMs = Math.round(performance.now() - startedAt);

  console.log(`status: ${response.status}  time: ${elapsedMs}ms`);

  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
