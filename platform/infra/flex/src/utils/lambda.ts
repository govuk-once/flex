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

import { ENV_KEYS, PLATFORM_KEYS } from "../ssm-keys";
import {
  type ArtifactEntry,
  getArtifactEntry,
  loadSignedArtifactsManifest,
} from "./manifest";

const SIGNED_BUCKET_CONSTRUCT_ID = "SignedArtifactsBucket";
const SIGNING_PROFILE_CONSTRUCT_ID = "LambdaSigningProfile";
const CODE_SIGNING_CONFIG_CONSTRUCT_ID = "LambdaCodeSigningConfig";

export function resolveEncryptionKey(scope: Construct): IKey {
  const encryptionKeyArn = StringParameter.valueForStringParameter(
    scope,
    ENV_KEYS.FlexEncryptionKey,
  );
  return Key.fromKeyArn(scope, "FlexEncryptionKey", encryptionKeyArn);
}

/**
 * Resolves the file path to `signed-artifacts.manifest.json`, allowing override
 * via `SIGNED_ARTIFACTS_MANIFEST_PATH` for tests and CI workflows.
 */
export function resolveManifestPath(): string {
  if (process.env.SIGNED_ARTIFACTS_MANIFEST_PATH) {
    return path.resolve(process.env.SIGNED_ARTIFACTS_MANIFEST_PATH);
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../signed-artifacts.manifest.json");
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

export interface SignedLambdaConfig {
  readonly code: Code;
  readonly codeSigningConfig: ICodeSigningConfig;
  readonly artifact: ArtifactEntry;
}

/**
 * Loads the signed artifact entry for `functionId` from `signed-artifacts.manifest.json`
 * and returns the versioned S3 `Code` and `CodeSigningConfig` to attach to `lambda.Function`.
 *
 * Fails loudly at synth time if the manifest is missing/invalid or has no entry for `functionId`.
 */
export function resolveSignedLambdaConfig(
  scope: Construct,
  functionId: string,
): SignedLambdaConfig {
  const manifestPath = resolveManifestPath();
  const manifest = loadSignedArtifactsManifest(manifestPath);
  const artifact = getArtifactEntry(manifest, functionId);

  const stack = Stack.of(scope);
  const signedBucket = getOrCreateSignedBucket(stack);
  const codeSigningConfig = getOrCreateCodeSigningConfig(stack);

  const code = Code.fromBucketV2(signedBucket, artifact.key, {
    objectVersion: artifact.version,
  });

  return {
    code,
    codeSigningConfig,
    artifact,
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
