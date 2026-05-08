import { route } from "@domain";

// Test handler for `type: "public"` integrations: invokes dvla's
// driving-licence endpoint via the public API URL, forwarding the
// caller's JWT. Used by scripts/cold-starts-cascade.ts to measure
// real chain cold-start latency end-to-end.
export const handler = route("GET /v1/cascade-public", async (ctx) => {
  const response = await ctx.integrations.dvlaDrivingLicencePublic({});

  return response.ok
    ? { status: 200, data: { upstream: response.status } }
    : { status: 502, error: { upstream: response.error } };
});
