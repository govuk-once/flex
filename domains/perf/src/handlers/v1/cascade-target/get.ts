import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Bare downstream Lambda for cascade testing. Mirrors profile-bare's
// shape so its cold-start floor is the irreducible Node + runtime
// init time, leaving the cascade script to surface end-to-end chain
// overhead cleanly.
export const handler: APIGatewayProxyHandlerV2 = () =>
  Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ ok: true, src: "cascade-target" }),
  });
