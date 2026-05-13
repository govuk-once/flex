import { getJwtClient } from "../tests/e2e/src/setup.global";
import * as fs from 'fs';

async function main() {
  const stage = process.env.STAGE || "development";

  try {
    console.log(`Initializing JwtClient for stage: ${stage}`);

    const generator = await getJwtClient(stage);
    const token = await generator.getToken();

    console.log("\n--------------------------------------------------");

    console.log("\nToken Generated Successfully:\n");
    console.log("::add-mask::token");

    const envFile = process.env.GITHUB_ENV;
    if (envFile) {
      // Append env var in github env file to share with the next step
      fs.appendFileSync(envFile, `ZAP_AUTH_HEADER_VALUE=Bearer ${token}\n`);
    }
    console.log("\nSaved in: ${envFile}");

    console.log("\n--------------------------------------------------");

  } catch (error) {
    console.error("\nError generating token:");

    if (error instanceof Error) {
      if (error.name.includes("Credentials") || error.message.includes("credentials")) {
        console.error("AWS credentials not found.");
      } else {
        console.error(error.message);
      }
    }
    process.exit(1);
  }
}

main();
