import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const SPECS_CURRENT_DIR = "dist/openapi/current";
const SPECS_LATEST_DIR = "dist/openapi/latest";
const OVERRIDE_LABEL = "breaking-change-accepted";
const BUCKET_NAME = "flex-development-openapi-specs";

const EnvSchema = z.object({
  OVERRIDE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const OasDiffBreakingSchema = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    level: z.number(), // 3 = ERR, 2 = WARN
    operation: z.string().optional(),
    path: z.string().optional(),
  }),
);

const env = EnvSchema.parse(process.env);
const s3 = new S3Client({ region: "us-east-1" });

function filterSpecs(files: (string | undefined)[]) {
  return files.filter(
    (f) => f && f.endsWith(".json") && f !== "index.json",
  ) as string[];
}

function listSpecs(dir: string) {
  if (!existsSync(dir)) return [];
  return filterSpecs(readdirSync(dir));
}

async function downloadLatestSpecFiles() {
  mkdirSync(SPECS_LATEST_DIR, { recursive: true });
  try {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: "docs",
      }),
    );

    const keys = filterSpecs((listed.Contents ?? []).map((o) => o.Key));

    for (const key of keys) {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      );

      if (!obj.Body) {
        throw new Error(`File contents missing for ${key}`);
      }

      writeFileSync(
        path.join(SPECS_LATEST_DIR, path.basename(key)),
        await obj.Body.transformToString(),
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "NoSuchBucket") {
      // in the case the infra has not been setup yet we don't have the latest files
      // the new deployment will upload the current ones as latest so we skip for now
      return;
    }
    throw err;
  }
}

function runOasdiff(latest: string, current: string) {
  const res = spawnSync(
    "oasdiff",
    ["breaking", latest, current, "--format", "json"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (res.error) {
    throw new Error(
      `oasdiff failed to start (is it installed?): ${res.error.message}`,
    );
  }
  const out = res.stdout.trim();
  if (res.status !== 0 && !out) {
    throw new Error(`oasdiff failed on ${current}: ${res.stderr}`);
  }
  return out ? OasDiffBreakingSchema.parse(out) : [];
}

async function main(): Promise<number> {
  const specs = listSpecs(SPECS_CURRENT_DIR);
  if (specs.length === 0) {
    throw new Error(
      "No specs generated Make sure the `pnpm openapi:generate` command is run first",
    );
  }

  await downloadLatestSpecFiles();
  let breakingFound = false;

  for (const name of specs) {
    const latestSpecPath = path.join(SPECS_LATEST_DIR, name);
    const currentSpecPath = path.join(SPECS_CURRENT_DIR, name);

    if (!existsSync(latestSpecPath)) {
      console.log(`No latest version of ${name}. Skipping`);
      continue;
    }

    const errors = runOasdiff(latestSpecPath, currentSpecPath).filter(
      (c) => c.level >= 3,
    );

    if (errors.length > 0) {
      breakingFound = true;
      console.log(
        `- ❌ \`${name}\`: **${String(errors.length)} breaking change(s)**`,
      );
      for (const c of errors) {
        const loc = [c.operation, c.path].filter(Boolean).join(" ");
        const fmtLoc = ` (${loc})`;
        console.log(`    - \`${c.id}\`${loc ? fmtLoc : ""}: ${c.text}`);
      }
    }
  }

  for (const name of listSpecs(SPECS_LATEST_DIR)) {
    if (!specs.includes(name)) {
      breakingFound = true;
      console.log(
        `- ❌ \`${name}\`: **spec removed** not available in ${SPECS_CURRENT_DIR}/)`,
      );
    }
  }

  if (breakingFound) {
    if (env.OVERRIDE) {
      console.log(
        `\n> ⚠️ Breaking changes were **accepted** via the \`${OVERRIDE_LABEL}\` label.`,
      );
      return 0;
    }
    return 1;
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
