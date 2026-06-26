import type { DomainIntegration } from "@flex/sdk";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { describe, expect, it, vi } from "vitest";

import { grantRoutePermissions } from "./integrations";

function createTarget(withRole = true) {
  const addToPrincipalPolicy = vi.fn();
  const role = withRole ? { addToPrincipalPolicy } : undefined;

  return {
    target: { role },
    addToPrincipalPolicy,
  };
}

function createApi() {
  const arnForExecuteApi = vi.fn(
    (method: string, path: string, stage: string) =>
      `arn:${method}:${path}:${stage}`,
  );

  return { api: { arnForExecuteApi }, arnForExecuteApi };
}

function createIntegrations(
  entries: Record<string, DomainIntegration>,
): ReadonlyMap<string, DomainIntegration> {
  return new Map(Object.entries(entries));
}

function statementsFrom(mock: ReturnType<typeof vi.fn>): PolicyStatement[] {
  return mock.mock.calls.map((call) => call[0] as PolicyStatement);
}

function onlyStatement(mock: ReturnType<typeof vi.fn>): PolicyStatement {
  const statements = statementsFrom(mock);
  expect(statements).toHaveLength(1);

  const [statement] = statements;
  if (!statement) throw new Error("expected exactly one policy statement");

  return statement;
}

describe("grantRoutePermissions", () => {
  it("does nothing when the target has no role", () => {
    const { target, addToPrincipalPolicy } = createTarget(false);
    const { api, arnForExecuteApi } = createApi();

    grantRoutePermissions(target, {
      keys: ["dvlaAuthenticate"],
      integrations: createIntegrations({
        dvlaAuthenticate: {
          type: "gateway",
          target: "dvla",
          route: "GET /v1/authenticate",
        },
      }),
      domain: "dvla",
      api,
    });

    expect(addToPrincipalPolicy).not.toHaveBeenCalled();
    expect(arnForExecuteApi).not.toHaveBeenCalled();
  });

  it("produces no IAM statements when keys is empty", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api, arnForExecuteApi } = createApi();

    grantRoutePermissions(target, {
      keys: [],
      integrations: createIntegrations({}),
      domain: "dvla",
      api,
    });

    expect(addToPrincipalPolicy).not.toHaveBeenCalled();
    expect(arnForExecuteApi).not.toHaveBeenCalled();
  });

  it("throws when a key is not in the resolved integrations map", () => {
    const { target } = createTarget();
    const { api } = createApi();

    expect(() => {
      grantRoutePermissions(target, {
        keys: ["missing"],
        integrations: createIntegrations({}),
        domain: "dvla",
        api,
      });
    }).toThrow(
      '"missing" was referenced in "integrations" but has not been resolved',
    );
  });

  it("adds a method-scoped statement for a gateway integration", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api, arnForExecuteApi } = createApi();

    grantRoutePermissions(target, {
      keys: ["dvlaAuthenticate"],
      integrations: createIntegrations({
        dvlaAuthenticate: {
          type: "gateway",
          target: "dvla",
          route: "GET /v1/authenticate",
        },
      }),
      domain: "dvla",
      api,
    });

    expect(arnForExecuteApi).toHaveBeenCalledWith(
      "GET",
      "/gateways/dvla/v1/authenticate",
      "*",
    );

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.sid).toBe("AllowApiAccessDvlaGET");
    expect(statement.effect).toBe(Effect.ALLOW);
    expect(statement.actions).toEqual(["execute-api:Invoke"]);
    expect(statement.resources).toEqual([
      "arn:GET:/gateways/dvla/v1/authenticate:*",
    ]);
  });

  it("falls back to the domain name when a gateway integration omits target", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["localAuthenticate"],
      integrations: createIntegrations({
        localAuthenticate: { type: "gateway", route: "GET /v1/authenticate" },
      }),
      domain: "dvla",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.resources).toEqual([
      "arn:GET:/gateways/dvla/v1/authenticate:*",
    ]);
  });

  it("falls back to the domain name when a domain integration omits target", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["selfLookup"],
      integrations: createIntegrations({
        selfLookup: { type: "domain", route: "GET /v1/identity/lookup" },
      }),
      domain: "udp",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.resources).toEqual([
      "arn:GET:/domains/udp/v1/identity/lookup:*",
    ]);
  });

  it("preserves a trailing wildcard in the resource arn", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["udpGetLinkingId"],
      integrations: createIntegrations({
        udpGetLinkingId: {
          type: "domain",
          target: "udp",
          route: "GET /v1/identity/*",
        },
      }),
      domain: "dvla",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.resources).toEqual([
      "arn:GET:/domains/udp/v1/identity/*:*",
    ]);
  });

  it("creates a separate statement per HTTP method", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["getThing", "createThing"],
      integrations: createIntegrations({
        getThing: { type: "gateway", target: "dvla", route: "GET /v1/thing" },
        createThing: {
          type: "gateway",
          target: "dvla",
          route: "POST /v1/thing",
        },
      }),
      domain: "dvla",
      api,
    });

    const statements = statementsFrom(addToPrincipalPolicy);
    expect(statements).toHaveLength(2);
    expect(statements.map((statement) => statement.sid)).toEqual([
      "AllowApiAccessDvlaGET",
      "AllowApiAccessDvlaPOST",
    ]);
    expect(statements.map((statement) => statement.resources)).toEqual([
      ["arn:GET:/gateways/dvla/v1/thing:*"],
      ["arn:POST:/gateways/dvla/v1/thing:*"],
    ]);
  });

  it("groups multiple routes of the same method into one statement", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["getA", "getB"],
      integrations: createIntegrations({
        getA: { type: "gateway", target: "dvla", route: "GET /v1/a" },
        getB: { type: "gateway", target: "dvla", route: "GET /v1/b" },
      }),
      domain: "dvla",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.resources).toEqual([
      "arn:GET:/gateways/dvla/v1/a:*",
      "arn:GET:/gateways/dvla/v1/b:*",
    ]);
  });

  it("deduplicates identical route prefixes within a method", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["primary", "duplicate"],
      integrations: createIntegrations({
        primary: { type: "gateway", target: "dvla", route: "GET /v1/thing" },
        duplicate: { type: "gateway", target: "dvla", route: "GET /v1/thing" },
      }),
      domain: "dvla",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.resources).toEqual(["arn:GET:/gateways/dvla/v1/thing:*"]);
  });

  it("pascal-cases a hyphenated domain in the statement sid", () => {
    const { target, addToPrincipalPolicy } = createTarget();
    const { api } = createApi();

    grantRoutePermissions(target, {
      keys: ["getThing"],
      integrations: createIntegrations({
        getThing: { type: "gateway", target: "dvla", route: "GET /v1/thing" },
      }),
      domain: "local-council",
      api,
    });

    const statement = onlyStatement(addToPrincipalPolicy);
    expect(statement.sid).toBe("AllowApiAccessLocalCouncilGET");
  });
});
