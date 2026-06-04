import { route } from "@domain";

import { runCascade } from "../../../cascade";

export const handler = route("GET /v1/cascade [private]", (ctx) =>
  runCascade({
    delays: ctx.queryParams.delays,
    hop: ctx.queryParams.hop,
    callNext: (query) => ctx.integrations.cascadeNext({ query }),
  }),
);
