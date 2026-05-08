import { route } from "@domain";

export const handler = route("GET /v1/cascade-local-council", async (ctx) => {
  const response = await ctx.integrations.localCouncilGetPublic({
    path: "/test-id",
  });

  return response.ok
    ? { status: 200, data: { upstream: response.status } }
    : { status: 502, error: { upstream: response.error } };
});
