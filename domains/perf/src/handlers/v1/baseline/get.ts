import { route } from "@domain";

export const handler = route("GET /v1/baseline", () =>
  Promise.resolve({ status: 200, data: { ok: true } }),
);
