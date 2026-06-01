import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

import { resolveCredentials } from "./credentials";

const cloudwatch = new CloudWatchClient({ region: "eu-west-2" });

export async function handler(): Promise<void> {
  const env = process.env.FLEX_ENVIRONMENT;
  if (!env) throw new Error("FLEX_ENVIRONMENT is not set");

  let success = false;

  try {
    const { accessToken, attestationToken, apiUrl } =
      await resolveCredentials(env);

    const response = await fetch(`https://${apiUrl}/app/udp/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(attestationToken && { "X-Firebase-App-Check": attestationToken }),
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status.toString()}`);
    }

    console.log("API call succeeded:", response.status);
    success = true;
  } catch (error) {
    console.error("Smoke test failed:", error);
  }

  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: "Flex/SmokeTest",
      MetricData: [
        {
          MetricName: "SmokeTestSuccess",
          Dimensions: [{ Name: "Environment", Value: env }],
          Value: success ? 1 : 0,
          Unit: "Count",
        },
      ],
    }),
  );
}
