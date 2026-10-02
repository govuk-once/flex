import fs from "node:fs";

import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getJwtClient } from "@flex/testing/e2e/setup";

async function main() {
  const stage = process.env.STAGE || "development";

  try {
    console.log(`Initializing JwtClient for stage: ${stage}`);

    const generator = await getJwtClient(stage);
    const token = await generator.getToken();

    const e2eBypassToken = await getSecret(
      `/${stage}/flex-secret/waf/e2e-bypass`,
    );

    if (!e2eBypassToken) {
      throw new Error(`E2E bypass secret not found for stage "${stage}"`);
    }

    console.log("\n--------------------------------------------------");

    console.log("\nToken Generated Successfully:\n");
    console.log(`::add-mask::${token}`);
    console.log(`::add-mask::${e2eBypassToken}`);

    const envFile = process.env.GITHUB_ENV;

    if (envFile) {
      // Append env var in github env file to share with the next step
      fs.appendFileSync(envFile, `ZAP_AUTH_HEADER_VALUE=Bearer ${token}\n`);
      fs.appendFileSync(envFile, `E2E_BYPASS_TOKEN=${e2eBypassToken}\n`);
      console.log(`\nSaved in: ${envFile}\n`);
    }

    console.log("\n--------------------------------------------------");
  } catch (error) {
    console.error("\nError generating token:");

    if (error instanceof Error) {
      if (
        error.name.includes("Credentials") ||
        error.message.includes("credentials")
      ) {
        console.error("AWS credentials not found.");
      } else {
        console.error(error.message);
      }
    }
    process.exit(1);
  }
}

void main();
