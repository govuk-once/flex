import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Bare upstream Lambda for cascade testing. The cascade script
// orchestrates the chain externally — it forces both this and
// cascade-target cold, then invokes them sequentially and sums the
// observed durations to approximate user-visible chain latency.
// Avoids the permissions-boundary deny on lambda:InvokeFunction
// that would block an in-Lambda chain.
export const handler: APIGatewayProxyHandlerV2 = () =>
  Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ ok: true, src: "cascade-entry" }),
  });
