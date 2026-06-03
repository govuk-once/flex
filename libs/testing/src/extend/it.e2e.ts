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
  authSub: string | undefined;
  authHeader: { Authorization: string };
}

let stubGeneratorPromise: ReturnType<typeof getStubTokenGenerator> | undefined;

const tokenByFile = new Map<string, Promise<string>>();

async function mintToken(authSub: string): Promise<string> {
  const { ENVIRONMENT, JWT } = inject("e2eEnv");

  if (ENVIRONMENT === "staging" || ENVIRONMENT === "production") {
    return JWT.VALID;
  }

  stubGeneratorPromise ??= getStubTokenGenerator();
  const generator = await stubGeneratorPromise;
  return generator.getToken(authSub);
}

function tokenForFile(fileId: string, authSub?: string): Promise<string> {
  if (!authSub) {
    // No pinned subject — generate a unique UUID per test for true isolation
    return mintToken(crypto.randomUUID());
  }
  // Pinned subject (e.g. STUB_DEFAULT_SUBJECT) — cache so the same token is
  // reused across all tests in the file that share this subject
  const key = `${fileId}::${authSub}`;
  const cached = tokenByFile.get(key) ?? mintToken(authSub);
  tokenByFile.set(key, cached);
  return cached;
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
    authSub: undefined,
    authHeader: async ({ task, authSub }, use) => {
      const token = await tokenForFile(task.file.filepath, authSub);
      await use({ Authorization: `Bearer ${token}` });
    },
  });
