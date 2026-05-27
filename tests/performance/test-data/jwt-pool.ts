import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getStubTokenGenerator, getStubTokenGeneratorFromJWK, getTokenGenerator } from "@flex/testing/e2e";
import { sanitiseStageName } from "@flex/utils";

const POOL_FILE = join(tmpdir(), `artillery-flex-jwt-pool-${process.env.PERF_SCENARIO ?? "default"}.json`);

// subs with this prefix are identifiable in UDP logs/DB.
// To clean up: DELETE FROM users WHERE userId LIKE 'flex-%'
const POOL_SIZE = parseInt(process.env.PERF_POOL_SIZE ?? "50");

let jwtPool: string[] = [];
let poolIndex = 0;
let stubGen: Awaited<ReturnType<typeof getStubTokenGenerator>> | undefined;

function deterministicSub(i: number): string {
  return `flex-${String(i).padStart(12, "0")}`;
}


async function warmUpUsers(): Promise<void> {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    console.warn("[perf] PERF_WARM_USERS=true but BASE_URL not set — skipping warm-up");
    return;
  }

  console.log(`[perf] warming up ${jwtPool.length} users against ${baseUrl}...`);

  const CONCURRENCY = 10;
  for (let i = 0; i < jwtPool.length; i += CONCURRENCY) {
    const batch = jwtPool.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((jwt) =>
        fetch(`${baseUrl}/app/udp/v1/users/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
          signal: AbortSignal.timeout(15_000),
        }).catch((err: Error) =>
          console.warn(`[perf] warm-up request failed: ${err.message}`),
        ),
      ),
    );
  }

  console.log("[perf] user warm-up complete");
}

async function buildStagingPool(): Promise<void> {
  console.log("[perf] staging: fetching real Cognito token...");
  const realGen = await getTokenGenerator("staging");
  const token = await realGen.getToken();
  jwtPool = Array.from({ length: POOL_SIZE }, () => token);
  console.log(`[perf] staging pool ready (single token, ${POOL_SIZE} slots)`);
}

async function buildDevPoolFromLocalJwk(rawJwk: string): Promise<void> {
  console.log("[perf] PERF_PRIVATE_JWK set — skipping Secrets Manager");
  stubGen = await getStubTokenGeneratorFromJWK(JSON.parse(rawJwk));
  console.log(`[perf] imported JWK kid=${stubGen.kid}`);
  jwtPool = await Promise.all(
    Array.from({ length: POOL_SIZE }, (_, i) => stubGen!.getToken(deterministicSub(i))),
  );
  console.log(`[perf] dev pool ready — ${jwtPool.length} tokens (local JWK)`);
}

async function buildDevPoolFromSecretsManager(): Promise<void> {
  console.log("[perf] fetching private key from Secrets Manager (requires AWS credentials)...");
  stubGen = await getStubTokenGenerator();
  console.log("[perf] Secrets Manager fetch complete, generating tokens...");
  jwtPool = await Promise.all(
    Array.from({ length: POOL_SIZE }, (_, i) => stubGen!.getToken(deterministicSub(i))),
  );
  console.log(`[perf] dev pool ready — ${jwtPool.length} tokens (Secrets Manager)`);
}

export async function buildUserPool(): Promise<void> {
  const stage = sanitiseStageName(process.env.STAGE) ?? "development";
  console.log(`[perf] building pool — stage=${stage} poolSize=${POOL_SIZE}`);

  if (stage === "staging") {
    await buildStagingPool();
  } else if (process.env.PERF_PRIVATE_JWK) {
    await buildDevPoolFromLocalJwk(process.env.PERF_PRIVATE_JWK);
  } else {
    await buildDevPoolFromSecretsManager();
  }

  writeFileSync(POOL_FILE, JSON.stringify(jwtPool));
  console.log(`[perf] pool written to ${POOL_FILE}`);

  if (process.env.PERF_WARM_USERS === "true") {
    await warmUpUsers();
  }
}

function ensurePoolLoaded(): void {
  if (jwtPool.length === 0 && existsSync(POOL_FILE)) {
    jwtPool = JSON.parse(readFileSync(POOL_FILE, "utf-8")) as string[];
    console.log(`[perf] worker loaded ${jwtPool.length} tokens from pool file`);
  }
}

export function pickUserJwt(
  context: { vars: Record<string, string> },
  _events: unknown,
  done: () => void,
): void {
  ensurePoolLoaded();
  if (jwtPool.length === 0) {
    throw new Error("[perf] JWT pool is empty in worker — before hook may not have run");
  }
  context.vars["jwt"] = jwtPool[poolIndex % jwtPool.length] as string;
  poolIndex++;
  done();
}
