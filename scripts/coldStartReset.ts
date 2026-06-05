import { coldStartStackName, recycleStack } from "./lib/coldStart";

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const region = process.env.AWS_REGION ?? "eu-west-2";
  const stackName = coldStartStackName(stage);

  const functionNames = await recycleStack(region, stackName);
  functionNames.forEach((functionName) =>
    console.log(`recycled ${functionName}`),
  );

  console.log(
    `\nRecycled ${functionNames.length} function(s) in "${stackName}". The next invocation of each will cold start.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
