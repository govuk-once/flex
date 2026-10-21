import {
  CloudWatchClient,
  type MetricDatum,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { EnvironmentSchema } from "@flex/utils";
import { z } from "zod";

import { type Credentials, resolveCredentials } from "./credentials";
import {
  DIMENSIONS,
  METRIC_NAMESPACE,
  METRICS,
  type Probe,
  probesForEnvironment,
} from "./probes";

const cloudwatch = new CloudWatchClient({ region: "eu-west-2" });

const PROBE_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const FALLBACK_TOKEN_LIFETIME_MS = 5 * 60_000;

interface ProbeResult {
  readonly probe: Probe;
  readonly success: boolean;
  readonly authRejected: boolean;
}

let cachedCredentials: { credentials: Credentials; expiresAt: number } | null =
  null;

const JwtPayloadSchema = z.object({ exp: z.number().optional() });

function tokenExpiry(token: string | undefined): number {
  const fallback = Date.now() + FALLBACK_TOKEN_LIFETIME_MS;
  const payload = token?.split(".")[1];
  if (!payload) return fallback;

  try {
    const { exp } = JwtPayloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return exp === undefined ? fallback : exp * 1000;
  } catch {
    return fallback;
  }
}

async function getCredentials(env: string): Promise<Credentials> {
  if (cachedCredentials && cachedCredentials.expiresAt > Date.now()) {
    return cachedCredentials.credentials;
  }

  const credentials = await resolveCredentials(env);
  const expiresAt =
    Math.min(
      tokenExpiry(credentials.accessToken),
      tokenExpiry(credentials.attestationToken),
    ) - TOKEN_EXPIRY_MARGIN_MS;
  cachedCredentials = { credentials, expiresAt };

  return credentials;
}

async function runProbe(
  probe: Probe,
  { accessToken, attestationToken, apiUrl }: Credentials,
): Promise<ProbeResult> {
  try {
    const response = await fetch(`https://${apiUrl}${probe.path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(attestationToken && { "X-Firebase-App-Check": attestationToken }),
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    const authRejected = response.status === 401 || response.status === 403;
    if (response.ok) {
      console.log(`${probe.journey} probe succeeded:`, response.status);
    } else {
      console.error(`${probe.journey} probe failed:`, response.status);
    }

    return { probe, success: response.ok, authRejected };
  } catch (error) {
    console.error(`${probe.journey} probe failed:`, error);
    return { probe, success: false, authRejected: false };
  }
}

async function runProbes(env: string, probes: readonly Probe[]) {
  try {
    const credentials = await getCredentials(env);
    return await Promise.all(
      probes.map((probe) => runProbe(probe, credentials)),
    );
  } catch (error) {
    cachedCredentials = null;
    console.error("Smoke test could not obtain credentials:", error);
    return probes.map((probe) => ({
      probe,
      success: false,
      authRejected: false,
    }));
  }
}

function toMetricData(env: string, results: readonly ProbeResult[]) {
  const environment = { Name: DIMENSIONS.environment, Value: env };

  const perProbe: MetricDatum[] = results.map(({ probe, success }) => ({
    MetricName: METRICS.success,
    Dimensions: [
      environment,
      { Name: DIMENSIONS.journey, Value: probe.journey },
    ],
    Value: success ? 1 : 0,
    Unit: "Count",
  }));

  const authRejected: MetricDatum = {
    MetricName: METRICS.authRejected,
    Dimensions: [environment],
    Value: results.filter((result) => result.authRejected).length,
    Unit: "Count",
  };

  return [...perProbe, authRejected];
}

export async function handler(): Promise<void> {
  const env = EnvironmentSchema.parse(process.env.FLEX_ENVIRONMENT);

  const results = await runProbes(env, probesForEnvironment(env));

  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: toMetricData(env, results),
    }),
  );
}
