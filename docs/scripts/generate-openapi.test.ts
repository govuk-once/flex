import path from "node:path";

import { describe, expect, it } from "vitest";

import { discoverDomainConfigs, loadDomainConfig } from "./generate-openapi";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const domainsRoot = path.join(projectRoot, "domains");

describe("discoverDomainConfigs", () => {
  it("discovers all domain.config.ts files in the domains directory", () => {
    const configs = discoverDomainConfigs(domainsRoot);

    expect(configs.length).toBeGreaterThan(0);
    configs.forEach((configPath) => {
      expect(configPath).toMatch(/domain\.config\.ts$/);
    });
  });

  it("includes known domains", () => {
    const configs = discoverDomainConfigs(domainsRoot);
    const domainNames = configs.map((c) => path.basename(path.dirname(c)));

    expect(domainNames).toContain("dvla");
    expect(domainNames).toContain("local-council");
    expect(domainNames).toContain("udp");
    expect(domainNames).toContain("uns");
    expect(domainNames).toContain("hello");
  });
});

describe("loadDomainConfig", () => {
  it("loads a domain() pattern config and returns the config object", async () => {
    const configPath = path.join(domainsRoot, "local-council/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).not.toBeNull();
    expect(mod?.config?.name).toBe("local-council");
    expect(mod?.config?.routes).toBeDefined();
  });

  it("returns null for legacy defineDomain() pattern (hello)", async () => {
    const configPath = path.join(domainsRoot, "hello/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).toBeNull();
  });

  it("returns null for a non-existent file", async () => {
    const configPath = path.join(domainsRoot, "non-existent/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).toBeNull();
  });

  it("extracts route versions from the config", async () => {
    const configPath = path.join(domainsRoot, "local-council/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    const versions = Object.keys(mod?.config?.routes ?? {});
    expect(versions).toContain("v1");
  });

  it("extracts route paths from the config", async () => {
    const configPath = path.join(domainsRoot, "local-council/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    const v1Routes = mod?.config?.routes?.v1 as Record<string, unknown>;
    const paths = Object.keys(v1Routes);
    expect(paths).toContain("/local-council/:id");
  });

  it("extracts route methods and access levels from the config", async () => {
    const configPath = path.join(domainsRoot, "local-council/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    const v1Routes = mod?.config?.routes?.v1 as Record<
      string,
      Record<string, unknown>
    >;
    const localCouncilRoute = v1Routes["/local-council/:id"];

    expect(localCouncilRoute).toHaveProperty("GET");
    expect(localCouncilRoute).toHaveProperty("POST");
  });

  it("loads dvla config with public routes", async () => {
    const configPath = path.join(domainsRoot, "dvla/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).not.toBeNull();
    expect(mod?.config?.name).toBe("dvla");
  });

  it("loads udp config with mixed public and private routes", async () => {
    const configPath = path.join(domainsRoot, "udp/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).not.toBeNull();
    expect(mod?.config?.name).toBe("udp");
  });

  it("loads uns config", async () => {
    const configPath = path.join(domainsRoot, "uns/domain.config.ts");
    const mod = await loadDomainConfig(configPath);

    expect(mod).not.toBeNull();
    expect(mod?.config?.name).toBe("uns");
  });
});
