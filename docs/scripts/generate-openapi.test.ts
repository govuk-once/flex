import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discoverDomainConfigs,
  generateIndexHtml,
  generateSpecForDomain,
  loadDomainConfig,
} from "./generate-openapi";

const fixturesRoot = path.join(import.meta.dirname, "fixtures");

describe("discoverDomainConfigs", () => {
  it("finds domain.config.ts files in subdirectories", () => {
    const configs = discoverDomainConfigs(fixturesRoot);
    const fileNames = configs.map((c) => path.basename(c));

    fileNames.forEach((name) => {
      expect(name).toBe("domain.config.ts");
    });
  });

  it("only discovers directories that contain domain.config.ts", () => {
    const configs = discoverDomainConfigs(fixturesRoot);
    const domainNames = configs.map((c) => path.basename(path.dirname(c)));

    expect(domainNames).toContain("valid-domain");
    expect(domainNames).toContain("invalid-domain");
    expect(domainNames).not.toContain("no-config-domain");
  });
});

describe("loadDomainConfig", () => {
  it("loads a valid domain() config", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    expect(mod).not.toBeNull();
    expect(mod?.config?.name).toBe("valid-domain");
    expect(mod?.config?.routes).toBeDefined();
  });

  it("extracts route versions from the config", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    const versions = Object.keys(mod?.config?.routes ?? {});
    expect(versions).toContain("v1");
  });

  it("extracts route paths and methods from the config", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    const v1Routes = mod?.config?.routes?.v1 as Record<
      string,
      Record<string, unknown>
    >;

    expect(v1Routes).toHaveProperty("/items");
    expect(v1Routes).toHaveProperty("/items/:id");
    expect(v1Routes["/items"]).toHaveProperty("GET");
    expect(v1Routes["/items"]).toHaveProperty("POST");
    expect(v1Routes["/items/:id"]).toHaveProperty("GET");
    expect(v1Routes["/items/:id"]).toHaveProperty("DELETE");
  });

  it("returns null for a config without routes (invalid pattern)", async () => {
    const configPath = path.join(
      fixturesRoot,
      "invalid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    expect(mod).toBeNull();
  });

  it("returns null for a non-existent file", async () => {
    const configPath = path.join(
      fixturesRoot,
      "non-existent/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    expect(mod).toBeNull();
  });
});

describe("generateSpecForDomain", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-docs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("generates a JSON spec from a loaded domain config", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    const name = generateSpecForDomain(mod!, tmpDir);

    expect(name).toBe("valid-domain");
    expect(fs.existsSync(path.join(tmpDir, "valid-domain.json"))).toBe(true);

    const spec = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "valid-domain.json"), "utf-8"),
    );
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("valid-domain API");
    expect(spec.paths["/v1/items"]).toBeDefined();
    expect(spec.paths["/v1/items/{id}"]).toBeDefined();
  });

  it("includes operationIds from route names", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    generateSpecForDomain(mod!, tmpDir);

    const spec = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "valid-domain.json"), "utf-8"),
    );
    expect(spec.paths["/v1/items"].get.operationId).toBe("get-items");
    expect(spec.paths["/v1/items"].post.operationId).toBe("create-item");
    expect(spec.paths["/v1/items/{id}"].get.operationId).toBe("get-item");
    expect(spec.paths["/v1/items/{id}"].delete.operationId).toBe(
      "delete-item",
    );
  });

  it("tags routes with public or private access", async () => {
    const configPath = path.join(
      fixturesRoot,
      "valid-domain/domain.config.ts",
    );
    const mod = await loadDomainConfig(configPath);

    generateSpecForDomain(mod!, tmpDir);

    const spec = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "valid-domain.json"), "utf-8"),
    );
    expect(spec.paths["/v1/items"].get.tags).toEqual(["public"]);
    expect(spec.paths["/v1/items"].post.tags).toEqual(["private"]);
  });

  it("returns null when config is missing", () => {
    const result = generateSpecForDomain({}, tmpDir);

    expect(result).toBeNull();
  });
});

describe("generateIndexHtml", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-docs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("generates an index.html with all domain URLs", () => {
    generateIndexHtml(["domain-a", "domain-b"], tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, "index.html"), "utf-8");
    expect(content).toContain("./domain-a.json");
    expect(content).toContain("./domain-b.json");
    expect(content).toContain('name: "domain-a"');
    expect(content).toContain('name: "domain-b"');
  });

  it("includes Swagger UI and StandaloneLayout", () => {
    generateIndexHtml(["test"], tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, "index.html"), "utf-8");
    expect(content).toContain("swagger-ui-bundle.js");
    expect(content).toContain("swagger-ui-standalone-preset.js");
    expect(content).toContain("StandaloneLayout");
    expect(content).toContain("Select a domain");
  });

  it("handles empty domain list", () => {
    generateIndexHtml([], tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, "index.html"), "utf-8");
    expect(content).toContain("urls: [");
  });
});
