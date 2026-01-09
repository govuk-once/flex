/* eslint-disable no-empty-pattern */
import { it as vitestIt } from "vitest";

import { createContext, createEvent } from "../fixtures";

interface Fixtures {
  context: ReturnType<typeof createContext>;
  event: ReturnType<typeof createEvent>;
}

export const it = vitestIt.extend<Fixtures>({
  context: async ({}, use) => use(createContext()),
  event: async ({}, use) => use(createEvent()),
});
