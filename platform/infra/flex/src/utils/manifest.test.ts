import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getArtifactEntry,
  InvalidManifestJsonError,
  loadSignedArtifactsManifest,
  MANIFEST_SCHEMA_VERSION,
  ManifestNotFoundError,
  ManifestValidationError,
  MissingArtifactEntryError,
} from "./manifest";

describe("Signed Artifacts Manifest Loader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "signed-manifest-tests-"),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeTempJson(filename: string, content: unknown): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
    return filePath;
  }

  function writeRawFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  it("successfully loads and parses a valid signed artifacts manifest", () => {
    const validManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      artifacts: {
        TopicsServiceGetTopics: {
          bucket: "govuk-once-flex-development-signed-artifacts-123456789012",
          key: "assets/TopicsServiceGetTopics/abc12345.zip",
          version: "v1.0.0-s3versionId",
          codeSize: 1048576,
        },
        AuthorizerFunction: {
          bucket: "govuk-once-flex-development-signed-artifacts-123456789012",
          key: "assets/AuthorizerFunction/def67890.zip",
          version: "v1.0.0-s3versionId2",
          codeSize: 524288,
        },
      },
    };

    const filePath = writeTempJson(
      "signed-artifacts.manifest.json",
      validManifest,
    );
    const result = loadSignedArtifactsManifest(filePath);

    expect(result.schemaVersion).toBe("1.0");
    expect(result.artifacts["TopicsServiceGetTopics"]).toEqual({
      bucket: "govuk-once-flex-development-signed-artifacts-123456789012",
      key: "assets/TopicsServiceGetTopics/abc12345.zip",
      version: "v1.0.0-s3versionId",
      codeSize: 1048576,
    });
    expect(result.artifacts["AuthorizerFunction"]).toBeDefined();
  });

  it("throws ManifestNotFoundError when the manifest file does not exist", () => {
    const nonExistentPath = path.join(tempDir, "does-not-exist.json");

    expect(() => loadSignedArtifactsManifest(nonExistentPath)).toThrow(
      ManifestNotFoundError,
    );
    expect(() => loadSignedArtifactsManifest(nonExistentPath)).toThrow(
      /Signed artifacts manifest not found at path/,
    );
  });

  it("throws InvalidManifestJsonError when the file contains malformed JSON", () => {
    const badJsonPath = writeRawFile(
      "corrupted.json",
      "{ invalid json syntax: missing quotes",
    );

    expect(() => loadSignedArtifactsManifest(badJsonPath)).toThrow(
      InvalidManifestJsonError,
    );
    expect(() => loadSignedArtifactsManifest(badJsonPath)).toThrow(
      /Failed to parse JSON in signed artifacts manifest/,
    );
  });

  it("throws ManifestValidationError when schemaVersion is invalid or unsupported", () => {
    const invalidVersionManifest = {
      schemaVersion: "2.0", // Unsupported schema version
      artifacts: {},
    };

    const filePath = writeTempJson("bad-version.json", invalidVersionManifest);

    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      ManifestValidationError,
    );
    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      /schemaVersion/,
    );
  });

  it("throws ManifestValidationError when artifacts dictionary is missing", () => {
    const missingArtifactsManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
    };

    const filePath = writeTempJson(
      "missing-artifacts.json",
      missingArtifactsManifest,
    );

    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      ManifestValidationError,
    );
    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      /artifacts/,
    );
  });

  it("throws ManifestValidationError when an artifact entry is missing required fields", () => {
    const incompleteEntryManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      artifacts: {
        MissingVersionFunction: {
          bucket: "my-bucket",
          key: "my-key.zip",
          // missing 'version' and 'codeSize'
        },
      },
    };

    const filePath = writeTempJson("incomplete.json", incompleteEntryManifest);

    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      ManifestValidationError,
    );
    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      /MissingVersionFunction.version/,
    );
  });

  it("throws ManifestValidationError when codeSize is negative or not an integer", () => {
    const badCodeSizeManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      artifacts: {
        BadSizeFunction: {
          bucket: "my-bucket",
          key: "my-key.zip",
          version: "v1",
          codeSize: -50,
        },
      },
    };

    const filePath = writeTempJson("bad-size.json", badCodeSizeManifest);

    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      ManifestValidationError,
    );
    expect(() => loadSignedArtifactsManifest(filePath)).toThrow(
      /codeSize/,
    );
  });

  describe("getArtifactEntry helper", () => {
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      artifacts: {
        FunctionA: {
          bucket: "bucket-a",
          key: "key-a.zip",
          version: "v1-a",
          codeSize: 100,
        },
      },
    };

    it("returns the artifact entry when the function ID exists in manifest", () => {
      const entry = getArtifactEntry(manifest, "FunctionA");
      expect(entry).toEqual({
        bucket: "bucket-a",
        key: "key-a.zip",
        version: "v1-a",
        codeSize: 100,
      });
    });

    it("throws MissingArtifactEntryError with available functions when function ID is missing", () => {
      expect(() => getArtifactEntry(manifest, "NonExistentFunction")).toThrow(
        MissingArtifactEntryError,
      );
      expect(() => getArtifactEntry(manifest, "NonExistentFunction")).toThrow(
        /No signed artifact found for function ID "NonExistentFunction" in manifest. Available functions: \[FunctionA\]/,
      );
    });
  });
});
