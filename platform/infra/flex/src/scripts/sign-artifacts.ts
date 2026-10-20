import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import type { Stage } from "@flex/utils";
import { getEnvConfig } from "@flex/utils";
import * as esbuild from "esbuild";

import { PLATFORM_KEYS } from "../ssm-keys";
import { createDeterministicZip } from "../utils/deterministic-zip";
import {
  enumerateFunctionEntries,
  type FunctionEntry,
} from "../utils/function-entries";
import {
  type ArtifactEntry,
  MANIFEST_SCHEMA_VERSION,
  type SignedArtifactsManifest,
  SignedArtifactsManifestSchema,
} from "../utils/manifest";

export const DEFAULT_MANIFEST_FILENAME = "signed-artifacts.manifest.json";
export const DEFAULT_WAITER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_POLL_INTERVAL_MS = 3_000; // 3 seconds

export interface SigningCoordinates {
  readonly unsignedBucket: string;
  readonly signedBucket: string;
  readonly signingProfileName: string;
  readonly signingProfileVersion: string;
}

export interface SignArtifactsClients {
  readonly s3: Pick<S3Client, "send">;
  readonly signer: Pick<SignerClient, "send">;
  readonly ssm: Pick<SSMClient, "send">;
}

export interface SignArtifactsOptions {
  readonly stage?: Stage;
  readonly region?: string;
  readonly manifestPath?: string;
  readonly entries?: readonly FunctionEntry[];
  readonly coordinates?: SigningCoordinates;
  readonly clients?: SignArtifactsClients;
  readonly bundleEntry?: (entryPath: string) => Promise<Buffer | string>;
  readonly waiterTimeoutMs?: number;
  readonly pollIntervalMs?: number;
}

/**
 * Resolves the default path for `signed-artifacts.manifest.json` inside `platform/infra/flex`.
 */
export function getDefaultManifestPath(): string {
  if (process.env.SIGNED_ARTIFACTS_MANIFEST_PATH) {
    return path.resolve(process.env.SIGNED_ARTIFACTS_MANIFEST_PATH);
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../..", DEFAULT_MANIFEST_FILENAME);
}

/**
 * Derives the unsigned artifacts bucket name from the signed artifacts bucket name
 * (or `UNSIGNED_ARTIFACTS_BUCKET` override if explicitly set).
 */
export function deriveUnsignedBucketName(signedBucket: string): string {
  if (process.env.UNSIGNED_ARTIFACTS_BUCKET) {
    return process.env.UNSIGNED_ARTIFACTS_BUCKET;
  }
  if (!signedBucket.includes("-signed-artifacts")) {
    throw new Error(
      `Cannot derive unsigned bucket name from signed bucket "${signedBucket}". Expected "-signed-artifacts" in bucket name or UNSIGNED_ARTIFACTS_BUCKET env var.`,
    );
  }
  return signedBucket.replace("-signed-artifacts", "-unsigned-artifacts");
}

/**
 * Fetches signing coordinates from AWS SSM Parameter Store under `/infra/signing/*`.
 */
export async function resolveSigningCoordinatesFromSsm(
  ssm: Pick<SSMClient, "send">,
): Promise<SigningCoordinates> {
  const parameterNames = [
    PLATFORM_KEYS.SignedArtifactsBucket,
    PLATFORM_KEYS.SigningProfileName,
    PLATFORM_KEYS.SigningProfileVersion,
  ];

  const response = await ssm.send(
    new GetParametersCommand({
      Names: parameterNames,
    }),
  );

  if (response.InvalidParameters && response.InvalidParameters.length > 0) {
    throw new Error(
      `Missing required signing SSM parameters: ${response.InvalidParameters.join(", ")}`,
    );
  }

  const paramMap = new Map<string, string>();
  for (const param of response.Parameters ?? []) {
    if (param.Name && param.Value) {
      paramMap.set(param.Name, param.Value);
    }
  }

  const signedBucket = paramMap.get(PLATFORM_KEYS.SignedArtifactsBucket);
  const signingProfileName = paramMap.get(PLATFORM_KEYS.SigningProfileName);
  const signingProfileVersion = paramMap.get(
    PLATFORM_KEYS.SigningProfileVersion,
  );

  if (!signedBucket || !signingProfileName || !signingProfileVersion) {
    throw new Error(
      "Incomplete signing coordinates returned from SSM Parameter Store",
    );
  }

  return {
    unsignedBucket: deriveUnsignedBucketName(signedBucket),
    signedBucket,
    signingProfileName,
    signingProfileVersion,
  };
}

/**
 * Bundles a TypeScript Lambda handler entry into a single CommonJS `index.js` payload
 * matching `aws-cdk-lib/aws-lambda-nodejs` NodejsFunction conventions (Node 24, CJS).
 */
export async function bundleLambdaEntry(entryPath: string): Promise<Buffer> {
  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    external: ["@aws-sdk/*"],
    write: false,
    outfile: "index.js",
  });

  const outputFile = result.outputFiles[0];
  if (!outputFile) {
    throw new Error(`esbuild produced no output for entry "${entryPath}"`);
  }

  return Buffer.from(outputFile.contents);
}

/**
 * Checks whether a signed artifact for the given function ID and content SHA-256
 * already exists in the signed versioned S3 bucket.
 */
async function findExistingSignedArtifact(
  s3: Pick<S3Client, "send">,
  signedBucket: string,
  signedPrefix: string,
): Promise<ArtifactEntry | undefined> {
  const listResponse = await s3.send(
    new ListObjectsV2Command({
      Bucket: signedBucket,
      Prefix: signedPrefix,
      MaxKeys: 1,
    }),
  );

  const existingObject = listResponse.Contents?.[0];
  if (!existingObject?.Key) {
    return undefined;
  }

  const headResponse = await s3.send(
    new HeadObjectCommand({
      Bucket: signedBucket,
      Key: existingObject.Key,
    }),
  );

  if (!headResponse.VersionId || headResponse.ContentLength === undefined) {
    return undefined;
  }

  return {
    bucket: signedBucket,
    key: existingObject.Key,
    version: headResponse.VersionId,
    codeSize: headResponse.ContentLength,
  };
}

/**
 * Polls AWS Signer until the signing job reaches `Succeeded`, or throws loudly on `Failed` / timeout.
 */
async function waitForSigningJobSuccess(
  signer: Pick<SignerClient, "send">,
  jobId: string,
  functionId: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<{ signedKey: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const job = await signer.send(new DescribeSigningJobCommand({ jobId }));

    if (job.status === "Succeeded") {
      const signedKey = job.signedObject?.s3?.key;
      if (!signedKey) {
        throw new Error(
          `Signing job "${jobId}" for function "${functionId}" succeeded but returned no signedObject.s3.key`,
        );
      }
      return { signedKey };
    }

    if (job.status === "Failed") {
      throw new Error(
        `Signing job "${jobId}" for function "${functionId}" failed: ${job.statusReason ?? "Unknown reason"}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out after ${String(timeoutMs)}ms waiting for signing job "${jobId}" for function "${functionId}"`,
  );
}

/**
 * Bundles, deterministically zips, uploads, signs, and writes `signed-artifacts.manifest.json`
 * for all enumerated functions in the target stage.
 */
export async function signAllArtifacts(
  options: SignArtifactsOptions = {},
): Promise<SignedArtifactsManifest> {
  const region = options.region ?? process.env.AWS_REGION ?? "eu-west-2";
  const manifestPath = options.manifestPath ?? getDefaultManifestPath();
  const waiterTimeoutMs = options.waiterTimeoutMs ?? DEFAULT_WAITER_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const bundleFn = options.bundleEntry ?? bundleLambdaEntry;

  const clients: SignArtifactsClients = options.clients ?? {
    s3: new S3Client({ region }),
    signer: new SignerClient({ region }),
    ssm: new SSMClient({ region }),
  };

  const coordinates =
    options.coordinates ??
    (await resolveSigningCoordinatesFromSsm(clients.ssm));

  const entries =
    options.entries ??
    (await enumerateFunctionEntries(
      options.stage ? { stage: options.stage } : {},
    ));

  if (entries.length === 0) {
    throw new Error("No Lambda function entries were enumerated to sign");
  }

  const artifacts: Record<string, ArtifactEntry> = {};

  for (const entry of entries) {
    const bundledCode = await bundleFn(entry.entry);
    const { buffer: zipBuffer, sha256 } = createDeterministicZip([
      { path: "index.js", content: bundledCode },
    ]);

    const unsignedKey = `assets/${entry.id}/${sha256}.zip`;
    const signedPrefix = `assets/${entry.id}/${sha256}/`;

    // Incremental check: reuse existing signed artifact if content hash is unchanged
    const existingSigned = await findExistingSignedArtifact(
      clients.s3,
      coordinates.signedBucket,
      signedPrefix,
    );

    if (existingSigned) {
      artifacts[entry.id] = existingSigned;
      continue;
    }

    // 1. Upload deterministic zip to versioned unsigned bucket
    const putResponse = await clients.s3.send(
      new PutObjectCommand({
        Bucket: coordinates.unsignedBucket,
        Key: unsignedKey,
        Body: zipBuffer,
        ContentType: "application/zip",
      }),
    );

    if (!putResponse.VersionId) {
      throw new Error(
        `Unsigned bucket "${coordinates.unsignedBucket}" did not return a VersionId for "${unsignedKey}". Ensure S3 bucket versioning is enabled.`,
      );
    }

    // 2. Start AWS Signer job
    const startResponse = await clients.signer.send(
      new StartSigningJobCommand({
        source: {
          s3: {
            bucketName: coordinates.unsignedBucket,
            key: unsignedKey,
            version: putResponse.VersionId,
          },
        },
        destination: {
          s3: {
            bucketName: coordinates.signedBucket,
            prefix: signedPrefix,
          },
        },
        profileName: coordinates.signingProfileName,
      }),
    );

    if (!startResponse.jobId) {
      throw new Error(
        `AWS Signer did not return a jobId when starting signing job for function "${entry.id}"`,
      );
    }

    // 3. Wait for signing job to reach Succeeded
    const { signedKey } = await waitForSigningJobSuccess(
      clients.signer,
      startResponse.jobId,
      entry.id,
      waiterTimeoutMs,
      pollIntervalMs,
    );

    // 4. Retrieve version and size of the signed object in the signed versioned bucket
    const headSignedResponse = await clients.s3.send(
      new HeadObjectCommand({
        Bucket: coordinates.signedBucket,
        Key: signedKey,
      }),
    );

    if (!headSignedResponse.VersionId) {
      throw new Error(
        `Signed bucket "${coordinates.signedBucket}" did not return a VersionId for signed object "${signedKey}". Ensure S3 bucket versioning is enabled.`,
      );
    }

    artifacts[entry.id] = {
      bucket: coordinates.signedBucket,
      key: signedKey,
      version: headSignedResponse.VersionId,
      codeSize: headSignedResponse.ContentLength ?? zipBuffer.length,
    };
  }

  const manifest: SignedArtifactsManifest = SignedArtifactsManifestSchema.parse(
    {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      artifacts,
    },
  );

  // Write manifest atomically via temp file + rename
  const manifestDir = path.dirname(manifestPath);
  fs.mkdirSync(manifestDir, { recursive: true });
  const tempPath = `${manifestPath}.tmp.${String(process.pid)}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  fs.renameSync(tempPath, manifestPath);

  return manifest;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const { stage } = getEnvConfig();
  console.log(`Starting Lambda artifact signing for stage "${stage}"...`);
  signAllArtifacts({ stage })
    .then((manifest) => {
      const count = Object.keys(manifest.artifacts).length;
      console.log(
        `Successfully signed ${String(count)} Lambda artifacts and wrote manifest.`,
      );
    })
    .catch((err: unknown) => {
      console.error("Failed to sign Lambda artifacts:", err);
      process.exit(1);
    });
}
