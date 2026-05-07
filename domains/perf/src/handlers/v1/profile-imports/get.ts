import { performance } from "node:perf_hooks";

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Bare handler (no @flex/sdk route() wrapping) so the handler body
// always runs regardless of event shape — the cold-starts probe
// invokes with `{}`, which would fail event validation in route().
//
// Imports happen inside the handler so that on FIRST invoke (cold
// container) they execute fresh and we get real timings; subsequent
// warm invokes hit Node's module cache and report ~0ms (expected).
//
// Init duration of this Lambda will look like profile-bare (~150ms)
// because @flex/sdk isn't imported. The import costs surface in the
// @duration of the first invoke and via the import-profile log line.
export const handler: APIGatewayProxyHandlerV2 = async () => {
  const stages: Record<string, number> = {};

  let t = performance.now();
  await import("@flex/udp-domain");
  stages.flexUdpDomain = performance.now() - t;

  t = performance.now();
  await import("@flex/dvla-service-gateway");
  stages.flexDvlaServiceGateway = performance.now() - t;

  t = performance.now();
  await import("@aws-sdk/client-ssm");
  stages.awsSdkClientSsm = performance.now() - t;

  console.log(JSON.stringify({ message: "import-profile", stages }));

  return { statusCode: 200, body: JSON.stringify({ ok: true, stages }) };
};
