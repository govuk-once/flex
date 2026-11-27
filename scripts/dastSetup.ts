import fs from "node:fs";

import { getJwtClient } from "@flex/testing/e2e/setup";

async function main() {
  const stage = process.env.STAGE || "development";

  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_ENV) {
    console.error("This script must run within GitHub Actions.");
    process.exit(1);
  }

  try {
    console.log(`Initializing JwtClient for stage: ${stage}`);

    const generator = await getJwtClient(stage);
    const token = await generator.getToken();

    console.log("\n--------------------------------------------------");

    console.log("\nToken Generated Successfully:\n");
    const envFile = process.env.GITHUB_ENV;

    if (!token || /[\r\n]/.test(token)) {
      throw new Error("Invalid token");
    }
    console.log(`::add-mask::${token.replace(/%/g, "%25")}`);

    if (envFile) {
      // Append env var in github env file to share with the next step
      fs.appendFileSync(envFile, `ZAP_AUTH_HEADER_VALUE=Bearer ${token}\n`);
      console.log(`\nSaved in: ${envFile}\n`);
    } else {
      throw new Error("Missing GitHub environment file");
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
        console.error("Failed to generate authentication token.");
      }
    }
    process.exit(1);
  }
}

void main();
