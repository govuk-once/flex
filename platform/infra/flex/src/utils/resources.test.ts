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

  it.for<{
    type: DomainResource["type"];
    path: string;
    scope: DomainResource["scope"];
    expected: string;
  }>([
    {
      type: "secret",
      path: "/flex-secret/example",
      scope: "stage",
      expected: "/ljones/flex-secret/example",
    },
    {
      type: "secret",
      path: "/flex-secret/example",
      scope: undefined,
      expected: "/development/flex-secret/example",
    },
    {
      type: "ssm:runtime",
      path: "/flex/example",
      scope: "stage",
      expected: "/ljones/flex/example",
    },
    {
      type: "ssm:runtime",
      path: "/flex/example",
      scope: undefined,
      expected: "/development/flex/example",
    },
  ])(
    "resolves $type $path with scope $scope to $expected",
    async ({ type, path, scope, expected }) => {
      const resources = await importForStage("ljones", {
        resource: { type, path, scope },
      });

      expect(resolvedName(resources.get("resource"))).toBe(expected);
    },
  );
});
