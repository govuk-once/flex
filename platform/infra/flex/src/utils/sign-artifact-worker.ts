import fs from "node:fs";

import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DescribeSigningJobCommand,
  SignerClient,
  StartSigningJobCommand,
} from "@aws-sdk/client-signer";
import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

import { PLATFORM_KEYS } from "../ssm-keys";

const WAITER_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 3_000;

interface SigningCoordinates {
  readonly unsignedBucket: string;
  readonly signedBucket: string;
  readonly signingProfileName: string;
}

async function resolveSigningCoordinates(
  ssm: SSMClient,
): Promise<SigningCoordinates> {
  const response = await ssm.send(
    new GetParametersCommand({
      Names: [
        PLATFORM_KEYS.SignedArtifactsBucket,
        PLATFORM_KEYS.SigningProfileName,
      ],
    }),
  );

  if (response.InvalidParameters && response.InvalidParameters.length > 0) {
    throw new Error(
      `Missing required signing SSM parameters: ${response.InvalidParameters.join(", ")}`,
    );
  }

  const params = new Map<string | undefined, string | undefined>(
    (response.Parameters ?? []).map((p) => [p.Name, p.Value]),
  );
  const signedBucket = params.get(PLATFORM_KEYS.SignedArtifactsBucket);
  const signingProfileName = params.get(PLATFORM_KEYS.SigningProfileName);

  if (!signedBucket || !signingProfileName) {
    throw new Error(
      "Incomplete signing coordinates returned from SSM Parameter Store",
    );
  }

  const unsignedBucket =
    process.env.UNSIGNED_ARTIFACTS_BUCKET ??
    signedBucket.replace("-signed-artifacts", "-unsigned-artifacts");

  return { unsignedBucket, signedBucket, signingProfileName };
}

async function findExistingSignedArtifact(
  s3: S3Client,
  signedBucket: string,
  signedPrefix: string,
): Promise<{ key: string; version: string } | undefined> {
  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: signedBucket,
      Prefix: signedPrefix,
      MaxKeys: 1,
    }),
  );

  const key = list.Contents?.[0]?.Key;
  if (!key) return undefined;

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: signedBucket, Key: key }),
  );
  if (!head.VersionId) return undefined;

  return { key, version: head.VersionId };
}

async function signSingleArtifact(
  functionId: string,
  sha256: string,
  zipBuffer: Buffer,
): Promise<{ key: string; version: string }> {
  const region = process.env.AWS_REGION ?? "eu-west-2";
  const s3 = new S3Client({ region });
  const signer = new SignerClient({ region });
  const ssm = new SSMClient({ region });

  const { unsignedBucket, signedBucket, signingProfileName } =
    await resolveSigningCoordinates(ssm);

  const unsignedKey = `assets/${functionId}/${sha256}.zip`;
  const signedPrefix = `assets/${functionId}/${sha256}/`;

  const existing = await findExistingSignedArtifact(
    s3,
    signedBucket,
    signedPrefix,
  );
  if (existing) {
    return existing;
  }

  const put = await s3.send(
    new PutObjectCommand({
      Bucket: unsignedBucket,
      Key: unsignedKey,
      Body: zipBuffer,
      ContentType: "application/zip",
    }),
  );

  if (!put.VersionId) {
    throw new Error(
      `Unsigned bucket "${unsignedBucket}" did not return a VersionId for "${unsignedKey}".`,
    );
  }

  const start = await signer.send(
    new StartSigningJobCommand({
      source: {
        s3: {
          bucketName: unsignedBucket,
          key: unsignedKey,
          version: put.VersionId,
        },
      },
      destination: {
        s3: {
          bucketName: signedBucket,
          prefix: signedPrefix,
        },
      },
      profileName: signingProfileName,
    }),
  );

  if (!start.jobId) {
    throw new Error(
      `AWS Signer did not return a jobId for function "${functionId}"`,
    );
  }

  const deadline = Date.now() + WAITER_TIMEOUT_MS;
  let signedKey: string | undefined;

  while (Date.now() <= deadline) {
    const job = await signer.send(
      new DescribeSigningJobCommand({ jobId: start.jobId }),
    );
    if (job.status === "Succeeded") {
      signedKey = job.signedObject?.s3?.key;
      break;
    }
    if (job.status === "Failed") {
      throw new Error(
        `Signing job "${start.jobId}" for "${functionId}" failed: ${job.statusReason ?? "Unknown"}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (!signedKey) {
    throw new Error(
      `Signing job "${start.jobId}" for "${functionId}" timed out or returned no key`,
    );
  }

  const headSigned = await s3.send(
    new HeadObjectCommand({ Bucket: signedBucket, Key: signedKey }),
  );

  if (!headSigned.VersionId) {
    throw new Error(
      `Signed bucket "${signedBucket}" did not return a VersionId for "${signedKey}"`,
    );
  }

  return { key: signedKey, version: headSigned.VersionId };
}

const [, , functionId, sha256] = process.argv;
if (!functionId || !sha256) {
  console.error("Usage: sign-artifact-worker.ts <functionId> <sha256>");
  process.exit(1);
}

const zipBuffer = fs.readFileSync(0);
signSingleArtifact(functionId, sha256, zipBuffer)
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })
  .catch((err: unknown) => {
    console.error(`Failed to sign artifact for "${functionId}":`, err);
    process.exit(1);
  });
