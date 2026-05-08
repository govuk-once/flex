import { route } from "@domain";

export const handler = route("GET /v1/cascade-public", async (ctx) => {
  const response = await ctx.integrations.dvlaDrivingLicencePublic({});

  return response.ok
    ? { status: 200, data: { upstream: response.status } }
    : { status: 502, error: { upstream: response.error } };
});
