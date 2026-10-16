import fs from "node:fs";
import { z } from "zod";

/**
 * Current version of the signed artifacts manifest schema.
 */
export const MANIFEST_SCHEMA_VERSION = "1.0" as const;

/**
 * Schema for an individual signed Lambda artifact entry.
 */
export const ArtifactEntrySchema = z.object({
  bucket: z.string().min(1, "Artifact bucket must not be empty"),
  key: z.string().min(1, "Artifact key must not be empty"),
  version: z.string().min(1, "Artifact version must not be empty"),
  codeSize: z
    .number()
    .int()
    .nonnegative("Artifact codeSize must be a non-negative integer"),
});

export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

/**
 * Top-level schema for signed-artifacts.manifest.json.
 */
export const SignedArtifactsManifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  artifacts: z.record(z.string(), ArtifactEntrySchema),
});

export type SignedArtifactsManifest = z.infer<
  typeof SignedArtifactsManifestSchema
>;

// ----------------------------------------------------------------------------
// Custom Error Classes
// ----------------------------------------------------------------------------

export class ManifestNotFoundError extends Error {
  constructor(filePath: string) {
    super(`Signed artifacts manifest not found at path: ${filePath}`);
    this.name = "ManifestNotFoundError";
  }
}

export class InvalidManifestJsonError extends Error {
  constructor(filePath: string, cause?: unknown) {
    super(
      `Failed to parse JSON in signed artifacts manifest at path: ${filePath}`,
      { cause },
    );
    this.name = "InvalidManifestJsonError";
  }
}

export class ManifestValidationError extends Error {
  constructor(filePath: string, issues: z.ZodIssue[]) {
    const formattedIssues = issues
      .map((i) => `  - ${i.path.join(".") || "root"}: ${i.message}`)
      .join("\n");
    super(
      `Signed artifacts manifest at "${filePath}" is invalid:\n${formattedIssues}`,
    );
    this.name = "ManifestValidationError";
  }
}

export class MissingArtifactEntryError extends Error {
  constructor(functionId: string, availableFunctionIds: string[]) {
    super(
      `No signed artifact found for function ID "${functionId}" in manifest. Available functions: [${availableFunctionIds
        .sort()
        .join(", ")}]`,
    );
    this.name = "MissingArtifactEntryError";
  }
}

// ----------------------------------------------------------------------------
// Loader Functions
// ----------------------------------------------------------------------------

/**
 * Loads, parses and validates the signed-artifacts.manifest.json file.
 * Fails loudly on missing file, unparseable JSON, or malformed schema shape.
 */
export function loadSignedArtifactsManifest(
  filePath: string,
): SignedArtifactsManifest {
  if (!fs.existsSync(filePath)) {
    throw new ManifestNotFoundError(filePath);
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read signed artifacts manifest at "${filePath}": ${(err as Error).message}`,
      { cause: err },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err) {
    throw new InvalidManifestJsonError(filePath, err);
  }

  const result = SignedArtifactsManifestSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new ManifestValidationError(filePath, result.error.issues);
  }

  return result.data;
}

/**
 * Retrieves a validated artifact entry for a specific function ID from the manifest.
 * Throws a loud descriptive error if the function ID is not present in the manifest.
 */
export function getArtifactEntry(
  manifest: SignedArtifactsManifest,
  functionId: string,
): ArtifactEntry {
  const entry = manifest.artifacts[functionId];
  if (!entry) {
    throw new MissingArtifactEntryError(
      functionId,
      Object.keys(manifest.artifacts),
    );
  }
  return entry;
}
