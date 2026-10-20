import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DescribeSigningJobCommand,
  StartSigningJobCommand,
} from "@aws-sdk/client-signer";
import { GetParametersCommand } from "@aws-sdk/client-ssm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLATFORM_KEYS } from "../ssm-keys";
import type { FunctionEntry } from "../utils/function-entries";
import { loadSignedArtifactsManifest } from "../utils/manifest";
import {
  deriveUnsignedBucketName,
  resolveSigningCoordinatesFromSsm,
  signAllArtifacts,
} from "./sign-artifacts";

const mockEntries: readonly FunctionEntry[] = [
  {
    id: "TopicsPublicV1GetTopics",
    entry: "/fake/domains/topics/src/handlers/v1/get-topics.ts",
    domain: "topics",
    category: "domain-route",
  },
  {
    id: "AuthorizerFunction",
    entry: "/fake/platform/domains/auth/src/handler.ts",
    domain: "auth",
    category: "platform",
  },
];

describe("sign-artifacts (PLAT-880)", () => {
  let tempDir: string;
  let manifestPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-sign-test-"));
    manifestPath = path.join(tempDir, "signed-artifacts.manifest.json");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("derives the unsigned bucket name from the signed bucket name", () => {
    expect(
      deriveUnsignedBucketName(
        "govuk-once-flex-development-signed-artifacts-123456789012",
      ),
    ).toBe("govuk-once-flex-development-unsigned-artifacts-123456789012");
  });

  it("resolves signing coordinates from SSM Parameter Store", async () => {
    const ssmSend = vi.fn().mockResolvedValue({
      Parameters: [
        {
          Name: PLATFORM_KEYS.SignedArtifactsBucket,
          Value: "govuk-once-flex-dev-signed-artifacts-111122223333",
        },
        {
          Name: PLATFORM_KEYS.SigningProfileName,
          Value: "flex_platform_signer",
        },
        {
          Name: PLATFORM_KEYS.SigningProfileVersion,
          Value: "v1",
        },
      ],
      InvalidParameters: [],
    });

    const coords = await resolveSigningCoordinatesFromSsm({ send: ssmSend });

    expect(ssmSend).toHaveBeenCalledOnce();
    expect(ssmSend.mock.calls[0]?.[0]).toBeInstanceOf(GetParametersCommand);
    expect(coords).toEqual({
      unsignedBucket: "govuk-once-flex-dev-unsigned-artifacts-111122223333",
      signedBucket: "govuk-once-flex-dev-signed-artifacts-111122223333",
      signingProfileName: "flex_platform_signer",
      signingProfileVersion: "v1",
    });
  });

  it("bundles, deterministically zips, signs all entries, and writes a valid manifest atomically", async () => {
    const s3Send = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof ListObjectsV2Command) {
        return { Contents: [] };
      }
      if (cmd instanceof PutObjectCommand) {
        return { VersionId: `unsigned-ver-${String(cmd.input.Key)}` };
      }
      if (cmd instanceof HeadObjectCommand) {
        return {
          VersionId: `signed-ver-for-${String(cmd.input.Key)}`,
          ContentLength: 2048,
        };
      }
      throw new Error(`Unexpected S3 command: ${String(cmd)}`);
    });

    let jobCounter = 0;
    const signerSend = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof StartSigningJobCommand) {
        jobCounter += 1;
        return { jobId: `job-${String(jobCounter)}` };
      }
      if (cmd instanceof DescribeSigningJobCommand) {
        const jobId = cmd.input.jobId ?? "unknown";
        return {
          status: "Succeeded",
          signedObject: {
            s3: {
              bucketName: "signed-bucket",
              key: `assets/signed/${jobId}.zip`,
            },
          },
        };
      }
      throw new Error(`Unexpected Signer command: ${String(cmd)}`);
    });

    const manifest = await signAllArtifacts({
      manifestPath,
      entries: mockEntries,
      coordinates: {
        unsignedBucket: "unsigned-bucket",
        signedBucket: "signed-bucket",
        signingProfileName: "flex_platform_signer",
        signingProfileVersion: "v1",
      },
      clients: {
        s3: { send: s3Send },
        signer: { send: signerSend },
        ssm: { send: vi.fn() },
      },
      bundleEntry: async (entryPath) =>
        `exports.handler = async () => "${entryPath}";`,
      pollIntervalMs: 1,
    });

    expect(Object.keys(manifest.artifacts)).toEqual([
      "TopicsPublicV1GetTopics",
      "AuthorizerFunction",
    ]);

    const loaded = loadSignedArtifactsManifest(manifestPath);
    expect(loaded).toEqual(manifest);
    expect(loaded.artifacts.TopicsPublicV1GetTopics).toEqual({
      bucket: "signed-bucket",
      key: "assets/signed/job-1.zip",
      version: "signed-ver-for-assets/signed/job-1.zip",
      codeSize: 2048,
    });
  });

  it("skips uploading and signing when an identical content hash already exists in the signed bucket", async () => {
    const s3Send = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof ListObjectsV2Command) {
        const prefix = cmd.input.Prefix ?? "";
        return {
          Contents: [{ Key: `${prefix}existing-job.zip` }],
        };
      }
      if (cmd instanceof HeadObjectCommand) {
        return {
          VersionId: "existing-signed-version-123",
          ContentLength: 1024,
        };
      }
      throw new Error(`Unexpected S3 command: ${String(cmd)}`);
    });

    const signerSend = vi.fn();

    const manifest = await signAllArtifacts({
      manifestPath,
      entries: mockEntries,
      coordinates: {
        unsignedBucket: "unsigned-bucket",
        signedBucket: "signed-bucket",
        signingProfileName: "flex_platform_signer",
        signingProfileVersion: "v1",
      },
      clients: {
        s3: { send: s3Send },
        signer: { send: signerSend },
        ssm: { send: vi.fn() },
      },
      bundleEntry: async () => "exports.handler = async () => 'unchanged';",
    });

    expect(signerSend).not.toHaveBeenCalled();
    expect(manifest.artifacts.TopicsPublicV1GetTopics?.version).toBe(
      "existing-signed-version-123",
    );
    expect(manifest.artifacts.AuthorizerFunction?.version).toBe(
      "existing-signed-version-123",
    );
  });

  it("fails loudly and does not write a manifest if any signing job fails", async () => {
    const s3Send = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof ListObjectsV2Command) {
        return { Contents: [] };
      }
      if (cmd instanceof PutObjectCommand) {
        return { VersionId: "v-unsigned-1" };
      }
      throw new Error(`Unexpected S3 command: ${String(cmd)}`);
    });

    const signerSend = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof StartSigningJobCommand) {
        return { jobId: "job-fail-1" };
      }
      if (cmd instanceof DescribeSigningJobCommand) {
        return {
          status: "Failed",
          statusReason: "Profile revoked by administrator",
        };
      }
      throw new Error(`Unexpected Signer command: ${String(cmd)}`);
    });

    await expect(
      signAllArtifacts({
        manifestPath,
        entries: mockEntries,
        coordinates: {
          unsignedBucket: "unsigned-bucket",
          signedBucket: "signed-bucket",
          signingProfileName: "flex_platform_signer",
          signingProfileVersion: "v1",
        },
        clients: {
          s3: { send: s3Send },
          signer: { send: signerSend },
          ssm: { send: vi.fn() },
        },
        bundleEntry: async () => "exports.handler = async () => 'ok';",
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow(
      /Signing job "job-fail-1" for function "TopicsPublicV1GetTopics" failed: Profile revoked by administrator/,
    );

    expect(fs.existsSync(manifestPath)).toBe(false);
  });
});
