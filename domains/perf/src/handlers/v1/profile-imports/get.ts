import { performance } from "node:perf_hooks";

import { route } from "@domain";

// Run timed dynamic imports at module top so they execute during
// cold-start init (and the resulting log line gets emitted regardless
// of whether the invoke event ever reaches the handler body).
// Top-level await is supported on Node.js 20+ Lambda runtime.
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

export const handler = route("GET /v1/profile-imports", () =>
  Promise.resolve({ status: 200, data: { ok: true, stages } }),
);
