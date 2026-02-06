// Include environments that use the real JWKS endpoint, otherwise use the stub
const REAL_JWKS_ENDPOINT_STAGES = new Set(["production"]);

export const isJwksStubEnabled = (stage: string) =>
  !REAL_JWKS_ENDPOINT_STAGES.has(stage);
