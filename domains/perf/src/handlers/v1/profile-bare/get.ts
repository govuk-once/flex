import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Deliberately imports nothing from @flex/sdk. The init duration
// reported for this Lambda is Node + Lambda runtime + esbuild
// scaffold only. The gap vs `baseline` is the full @flex/sdk cost.
export const handler: APIGatewayProxyHandlerV2 = () =>
  Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  });
