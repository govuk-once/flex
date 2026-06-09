import {
  callCascade,
  coldStartStackName,
  getCascadeToken,
  recycleStack,
  resolveCascadeUrl,
} from "./lib/coldStart";

const MAX_DEPTH_CAP = 10;

interface SweepRow {
  readonly depth: number;
  readonly coldMs: number;
  readonly warmMs: number;
}

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const region = process.env.AWS_REGION ?? "eu-west-2";
  const stackName = coldStartStackName(stage);
  const maxDepth = Math.min(Number(process.env.MAX_DEPTH ?? "5"), MAX_DEPTH_CAP);

  const cascadeUrl = await resolveCascadeUrl(stage);
  const token = await getCascadeToken(stage);

  const depths = Array.from({ length: maxDepth }, (_, index) => index + 1);
  const rows: SweepRow[] = [];

  for (const depth of depths) {
    const delays = Array(depth).fill("0").join(",");

    await recycleStack(region, stackName);
    const cold = await callCascade(cascadeUrl, token, delays);
    const warm = await callCascade(cascadeUrl, token, delays);

    rows.push({ depth, coldMs: cold.timeMs, warmMs: warm.timeMs });
    console.error(
      `depth ${depth}: cold ${cold.timeMs}ms (status ${cold.status}), warm ${warm.timeMs}ms`,
    );
  }

  console.log("\n| depth | cold ms | warm ms | penalty ms |");
  console.log("|---|---|---|---|");
  rows.forEach((row) =>
    console.log(
      `| ${row.depth} | ${row.coldMs} | ${row.warmMs} | ${row.coldMs - row.warmMs} |`,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
