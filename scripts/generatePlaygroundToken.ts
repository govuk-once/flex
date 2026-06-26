import {
  createTokenGeneratorFromConfig,
  type JwtAuthConfig,
} from "@flex/testing/e2e";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ quiet: true });

const PlaygroundEnvSchema = z.object({
  PLAYGROUND_EMAIL: z.email(),
  PLAYGROUND_PASSWORD: z.string().min(1),
  PLAYGROUND_TOTP_SEED: z.string().min(1),
  PLAYGROUND_CLIENT_ID: z.string().min(1),
  PLAYGROUND_AUTH_URL: z.string().min(1),
  PLAYGROUND_TOKEN_URL: z.string().min(1),
  PLAYGROUND_ONE_LOGIN_ENV: z.string().min(1),
});

function readConfig(): JwtAuthConfig {
  const result = PlaygroundEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\nMissing or invalid playground environment variables:\n");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error(
      "\nCopy .env.playground.example to .env and fill in the values you were given.\n",
    );
    process.exit(1);
  }

  const env = result.data;

  return {
    email: env.PLAYGROUND_EMAIL,
    password: env.PLAYGROUND_PASSWORD,
    totp: env.PLAYGROUND_TOTP_SEED,
    clientId: env.PLAYGROUND_CLIENT_ID,
    authUrl: env.PLAYGROUND_AUTH_URL,
    tokenUrl: env.PLAYGROUND_TOKEN_URL,
    oneLoginEnvironment: env.PLAYGROUND_ONE_LOGIN_ENV,
    redirectUri: "govuk://govuk/login-auth-callback",
  };
}

async function main() {
  try {
    console.log("Generating playground token...");

    const generator = createTokenGeneratorFromConfig(readConfig());
    const token = await generator.getToken();

    console.log("\n--------------------------------------------------");
    console.log("\nToken Generated Successfully:\n");
    console.log(token);
    console.log("\n--------------------------------------------------");
  } catch (error) {
    console.error("\nError generating token:");

    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

void main();
