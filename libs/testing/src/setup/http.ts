import { afterAll, beforeAll } from "vitest";

import { network } from "../fixtures/http";

beforeAll(() => {
  network.disable();
});

afterAll(() => {
  network.enable();
});
