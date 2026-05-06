import { route } from "@domain";

export const handler = route("GET /v1/baseline-512mb", () =>
  Promise.resolve({ status: 200, data: { ok: true } }),
);
