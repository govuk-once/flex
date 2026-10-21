import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  LambdaClient,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";

import { resolveCredentials } from "./credentials";

const cloudwatch = new CloudWatchClient({ region: "eu-west-2" });
const lambdaClient = new LambdaClient({ region: "eu-west-2" });

/**
 * Minimal valid empty PKZIP archive (22-byte End of Central Directory record).
 * Because this archive has not been signed by AWS Signer, any attempt to deploy it
 * to a Lambda function with `UntrustedArtifactOnDeployment: ENFORCE` must be rejected
 * with `CodeVerificationFailedException`.
 */
export const UNSIGNED_PROBE_ZIP = Buffer.from(
  "504b0506000000000000000000000000000000000000",
  "hex",
);

/**
 * Positive runtime check in the development account proving that an unsigned code
 * deployment is actively refused by AWS Lambda's enforced CodeSigningConfig.
 */
export async function verifyUnsignedDeploymentRejected(
  functionName: string,
  client: Pick<LambdaClient, "send"> = lambdaClient,
): Promise<void> {
  try {
    await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: UNSIGNED_PROBE_ZIP,
      }),
    );
  } catch (error) {
    const errName = (error as { name?: string })?.name ?? "";
    const errMessage = (error as { message?: string })?.message ?? "";

    if (
      errName === "CodeVerificationFailedException" ||
      errMessage.includes("CodeVerificationFailedException") ||
      errMessage.toLowerCase().includes("code signing") ||
      errMessage.toLowerCase().includes("untrusted")
    ) {
      console.log(
        `Verified unsigned deployment rejection for "${functionName}": ${errName}`,
      );
      return;
    }

    throw new Error(
      `Unsigned deployment probe for "${functionName}" failed with unexpected error (${errName}): ${errMessage}`,
      { cause: error },
    );
  }

  throw new Error(
    `Security violation: unsigned code deployment to "${functionName}" was NOT rejected by AWS Lambda CodeSigningConfig!`,
  );
}

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

    if (env === "development" && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      await verifyUnsignedDeploymentRejected(
        process.env.AWS_LAMBDA_FUNCTION_NAME,
      );
    }

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
