import { inject, it as vitestIt } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

import { E2EEnv } from "../config/env";
import { createApi } from "../fixtures";
import { getStubTokenGenerator } from "../fixtures/StubTokenGenerator";

const E2E_BYPASS_HEADER = "x-flex-e2e-bypass";

interface Fixtures {
  cloudfront: ReturnType<typeof createApi>;
  privateGateway: ReturnType<typeof createApi>;
  authSub: string | undefined;
  authHeader: { Authorization: string; [E2E_BYPASS_HEADER]: string };
}

let stubGeneratorPromise: ReturnType<typeof getStubTokenGenerator> | undefined;

const tokenByFile = new Map<string, Promise<string>>();

async function mintToken(
  authSub: string = crypto.randomUUID(),
): Promise<string> {
  const { ENVIRONMENT, JWT } = inject("e2eEnv");

  if (ENVIRONMENT === "staging" || ENVIRONMENT === "production") {
    return JWT.VALID;
  }

  stubGeneratorPromise ??= getStubTokenGenerator();
  const generator = await stubGeneratorPromise;
  return generator.getToken(authSub);
}

function tokenForFile(fileId: string, authSub = ""): Promise<string> {
  const key = `${fileId}::${authSub}`;
  let token = tokenByFile.get(key);
  if (!token) {
    token = mintToken(authSub);
    tokenByFile.set(key, token);
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
    authSub: undefined,
    authHeader: async ({ task, authSub }, use) => {
      const token = await tokenForFile(task.file.filepath, authSub);
      const { E2E_BYPASS_TOKEN } = inject("e2eEnv");
      await use({
        Authorization: `Bearer ${token}`,
        [E2E_BYPASS_HEADER]: E2E_BYPASS_TOKEN,
      });
    },
  });
