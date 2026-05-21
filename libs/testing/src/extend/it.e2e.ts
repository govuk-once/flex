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

let stubGeneratorPromise: ReturnType<typeof getStubTokenGenerator> | undefined;

const tokenByFile = new Map<string, Promise<string>>();

async function mintToken(): Promise<string> {
  const { ENVIRONMENT, JWT } = inject("e2eEnv");

  if (ENVIRONMENT === "staging" || ENVIRONMENT === "production") {
    return JWT.VALID;
  }

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
