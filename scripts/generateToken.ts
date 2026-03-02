import { getJwtClient } from "../tests/e2e/src/setup.global";

async function main() {
  const stage = process.env.STAGE || "development";

  try {
    console.log(`Initializing JwtClient for stage: ${stage}`);

    const generator = await getJwtClient(stage);
    const token = await generator.getToken();

    console.log("\n--------------------------------------------------");

    console.log("\nToken Generated Successfully:\n");
    console.log(token);

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
