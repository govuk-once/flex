import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FunctionConfig } from "@flex/sdk";
import { Duration, Stack } from "aws-cdk-lib";
import { type IKey, Key } from "aws-cdk-lib/aws-kms";
import {
  Code,
  CodeSigningConfig,
  type ICodeSigningConfig,
  UntrustedArtifactOnDeployment,
} from "aws-cdk-lib/aws-lambda";
import { Bucket, type IBucket } from "aws-cdk-lib/aws-s3";
import { SigningProfile } from "aws-cdk-lib/aws-signer";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as esbuild from "esbuild";

import { ENV_KEYS, PLATFORM_KEYS } from "../ssm-keys";
import { createDeterministicZip } from "./deterministic-zip";

const SIGNED_BUCKET_CONSTRUCT_ID = "SignedArtifactsBucket";
const SIGNING_PROFILE_CONSTRUCT_ID = "LambdaSigningProfile";
const CODE_SIGNING_CONFIG_CONSTRUCT_ID = "LambdaCodeSigningConfig";

const workerScriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "sign-artifact-worker.ts",
);

const artifactCache = new Map<string, { key: string; version: string }>();

export function resolveEncryptionKey(scope: Construct): IKey {
  const encryptionKeyArn = StringParameter.valueForStringParameter(
    scope,
    ENV_KEYS.FlexEncryptionKey,
  );
  return Key.fromKeyArn(scope, "FlexEncryptionKey", encryptionKeyArn);
}

function getOrCreateSignedBucket(stack: Stack): IBucket {
  const existing = stack.node.tryFindChild(SIGNED_BUCKET_CONSTRUCT_ID) as
    | IBucket
    | undefined;
  if (existing) {
    return existing;
  }

  const bucketName = StringParameter.valueForStringParameter(
    stack,
    PLATFORM_KEYS.SignedArtifactsBucket,
  );

  return Bucket.fromBucketName(stack, SIGNED_BUCKET_CONSTRUCT_ID, bucketName);
}

function getOrCreateCodeSigningConfig(stack: Stack): ICodeSigningConfig {
  const existing = stack.node.tryFindChild(CODE_SIGNING_CONFIG_CONSTRUCT_ID) as
    | ICodeSigningConfig
    | undefined;
  if (existing) {
    return existing;
  }

  const signingProfileName = StringParameter.valueForStringParameter(
    stack,
    PLATFORM_KEYS.SigningProfileName,
  );
  const signingProfileVersion = StringParameter.valueForStringParameter(
    stack,
    PLATFORM_KEYS.SigningProfileVersion,
  );

  const signingProfile = SigningProfile.fromSigningProfileAttributes(
    stack,
    SIGNING_PROFILE_CONSTRUCT_ID,
    {
      signingProfileName,
      signingProfileVersion,
    },
  );

  return new CodeSigningConfig(stack, CODE_SIGNING_CONFIG_CONSTRUCT_ID, {
    signingProfiles: [signingProfile],
    untrustedArtifactOnDeployment: UntrustedArtifactOnDeployment.ENFORCE,
    description: `Enforced Lambda code signing configuration for ${stack.stackName}`,
  });
}

function bundleAndResolveSignedArtifact(
  functionId: string,
  entry: string,
): { key: string; version: string } {
  const buildResult = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    external: ["@aws-sdk/*"],
    write: false,
    outfile: "index.js",
  });

  const outputFile = buildResult.outputFiles[0];
  if (!outputFile) {
    throw new Error(`esbuild produced no output for entry "${entry}"`);
  }

  const { buffer: zipBuffer, sha256 } = createDeterministicZip([
    { path: "index.js", content: Buffer.from(outputFile.contents) },
  ]);

  const cacheKey = `${functionId}:${sha256}`;
  const cached = artifactCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (process.env.SIGN_LAMBDA_ARTIFACTS !== "true") {
    const offline = {
      key: `assets/${functionId}/${sha256}/signed.zip`,
      version: `synth-${sha256.slice(0, 12)}`,
    };
    artifactCache.set(cacheKey, offline);
    return offline;
  }

  const stdout = execFileSync(
    process.execPath,
    ["--import", "tsx", workerScriptPath, functionId, sha256],
    {
      input: zipBuffer,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  const signed = JSON.parse(stdout.trim()) as { key: string; version: string };
  artifactCache.set(cacheKey, signed);
  return signed;
}

export interface SignedLambdaConfig {
  readonly code: Code;
  readonly codeSigningConfig: ICodeSigningConfig;
  readonly handler: string;
}

/**
 * Bundles `entry` with esbuild, creates a deterministic ZIP, signs it via AWS Signer
 * (when `SIGN_LAMBDA_ARTIFACTS=true`), and returns the versioned S3 `Code` + `CodeSigningConfig`.
 */
export function resolveSignedLambdaConfig(
  scope: Construct,
  functionId: string,
  entry?: string,
): SignedLambdaConfig {
  if (!entry) {
    throw new Error(`Lambda function "${functionId}" is missing an entry path`);
  }

  const stack = Stack.of(scope);
  const signedBucket = getOrCreateSignedBucket(stack);
  const codeSigningConfig = getOrCreateCodeSigningConfig(stack);
  const artifact = bundleAndResolveSignedArtifact(functionId, entry);

  const code = Code.fromBucketV2(signedBucket, artifact.key, {
    objectVersion: artifact.version,
  });

  return {
    code,
    codeSigningConfig,
    handler: "index.handler",
  };
}

export function toFunctionConfig(
  route?: FunctionConfig,
  common?: FunctionConfig,
) {
  const environment = { ...common?.environment, ...route?.environment };
  const memorySize = route?.memorySize ?? common?.memorySize;
  const timeoutSeconds = route?.timeoutSeconds ?? common?.timeoutSeconds ?? 15;

  return {
    ...(Object.keys(environment).length > 0 && { environment }),
    ...(memorySize && { memorySize }),
    ...(timeoutSeconds && { timeout: Duration.seconds(timeoutSeconds) }),
  };
}
