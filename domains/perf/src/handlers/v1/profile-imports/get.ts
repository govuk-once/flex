import { performance } from "node:perf_hooks";

import { route } from "@domain";

// Each cold start triggers a fresh module-instantiation pass. Dynamic
// imports inside the handler force these to run on first invoke,
// where we can time them individually. The breakdown is logged so
// it surfaces in CloudWatch alongside the REPORT line we already
// capture for init duration.
export const handler = route("GET /v1/profile-imports", async () => {
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

  return { status: 200, data: { ok: true, stages } };
});
