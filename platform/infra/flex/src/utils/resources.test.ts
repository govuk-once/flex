import type { DomainResource } from "@flex/sdk";
import { App, Stack } from "aws-cdk-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importForStage(
  stage: string,
  resources: Record<string, DomainResource>,
) {
  vi.resetModules();
  vi.stubEnv("STAGE", stage);
  const { importResources } = await import("./resources");
  const stack = new Stack(new App(), "TestStack");

  return importResources(stack, new Map(Object.entries(resources)));
}

function resolvedName(resource?: { type: string; construct: unknown }) {
  const construct = resource?.construct as
    | { secretName?: string; parameterName?: string }
    | undefined;

  return construct?.secretName ?? construct?.parameterName;
}

describe("importResources", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes stage-scoped secrets with the stage only", async () => {
    const resources = await importForStage("ljones", {
      stageSecret: {
        type: "secret",
        path: "/flex-secret/example",
        scope: "stage",
      },
    });

    expect(resolvedName(resources.get("stageSecret"))).toBe(
      "/ljones/flex-secret/example",
    );
  });

  it("prefixes environment-scoped secrets with the environment", async () => {
    const resources = await importForStage("ljones", {
      envSecret: { type: "secret", path: "/flex-secret/example" },
    });

    expect(resolvedName(resources.get("envSecret"))).toBe(
      "/development/flex-secret/example",
    );
  });

  it("prefixes SSM parameters the same way as secrets", async () => {
    const resources = await importForStage("ljones", {
      stageParam: {
        type: "ssm:runtime",
        path: "/flex/example",
        scope: "stage",
      },
      envParam: { type: "ssm:runtime", path: "/flex/example-env" },
    });

    expect(resolvedName(resources.get("stageParam"))).toBe(
      "/ljones/flex/example",
    );
    expect(resolvedName(resources.get("envParam"))).toBe(
      "/development/flex/example-env",
    );
  });
});
