import {
  callCascade,
  getCascadeToken,
  resolveCascadeUrl,
} from "./lib/coldStart";

const DEFAULT_DELAYS = "200,200,200,200,200";

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const delays = process.env.DELAYS ?? process.argv[2] ?? DEFAULT_DELAYS;

  const cascadeUrl = await resolveCascadeUrl(stage);
  const token = await getCascadeToken(stage);

  console.log(`GET ${cascadeUrl}?delays=${delays}\n`);

  const { status, timeMs, body } = await callCascade(cascadeUrl, token, delays);

  console.log(`status: ${status}  time: ${timeMs}ms`);

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
