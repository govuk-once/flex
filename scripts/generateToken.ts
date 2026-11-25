import { getJwtClient } from "@flex/testing/e2e/setup";

async function main() {
  const stage = process.env.STAGE || "development";

  const showToken = process.argv.includes("--show-token");

  if (
    showToken &&
    (process.env.GITHUB_ACTIONS === "true" ||
      process.env.CI ||
      !process.stdout.isTTY)
  ) {
    console.error(
      "Token output requires an interactive local terminal outside CI.",
    );
    process.exit(1);
  }

  try {
    console.log(`Initializing JwtClient for stage: ${stage}`);

    const generator = await getJwtClient(stage);
    const token = await generator.getToken();

    console.log("\n--------------------------------------------------");

    console.log("\nToken Generated Successfully:\n");
    if (showToken) {
      console.warn("Sensitive token - do not share or store in logs.");
      process.stdout.write(`${token}\n`);
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
