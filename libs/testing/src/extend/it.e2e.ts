import { inject, it as vitestIt } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

import { E2EEnv } from "../config/env";
import { createApi } from "../fixtures";
import { getStubTokenGenerator } from "../fixtures/StubTokenGenerator";

interface Fixtures {
  cloudfront: ReturnType<typeof createApi>;
  privateGateway: ReturnType<typeof createApi>;
  authHeader: { Authorization: string };
}

// One stub generator per worker so the signing key is read only once.
let stubGeneratorPromise: ReturnType<typeof getStubTokenGenerator> | undefined;

// One bearer token per test file. Each file (suite) runs as an isolated user,
// while tests within a file keep sharing it so ordered flows still work.
const tokenByFile = new Map<string, Promise<string>>();

async function mintToken(): Promise<string> {
  const { ENVIRONMENT, JWT } = inject("e2eEnv");

  // Staging and production reuse the single One Login user authenticated once
  // in global setup; logging in per file there would hammer One Login.
  if (ENVIRONMENT === "staging" || ENVIRONMENT === "production") {
    return JWT.VALID;
  }

  // Development and feature stages use the stub. A unique subject per file
  // gives each suite an isolated pairwise identity, so suites can run in
  // parallel without clashing on shared service entities.
  stubGeneratorPromise ??= getStubTokenGenerator();
  const generator = await stubGeneratorPromise;
  return generator.getToken(crypto.randomUUID());
}

function tokenForFile(fileId: string): Promise<string> {
  let token = tokenByFile.get(fileId);
  if (!token) {
    token = mintToken();
    tokenByFile.set(fileId, token);
  }
  return token;
}

export const extendIt = () =>
  vitestIt.extend<Fixtures>({
    cloudfront: async ({ signal }, use) => {
      const { FLEX_API_URL } = inject("e2eEnv");
      await use(createApi(`${FLEX_API_URL}/app`, { signal }));
    },
    privateGateway: async ({ signal }, use) => {
      const { FLEX_PRIVATE_GATEWAY_URL } = inject("e2eEnv");
      await use(createApi(FLEX_PRIVATE_GATEWAY_URL, { signal }));
    },
    authHeader: async ({ task }, use) => {
      const token = await tokenForFile(task.file.filepath);
      await use({ Authorization: `Bearer ${token}` });
    },
  });
