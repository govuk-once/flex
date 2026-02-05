import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("Gateway", () => {
  const ingressPath = "/app";
  const domainVersion = "v1";
  const endpoint = `${ingressPath}/${domainVersion}/user`;
  const token = "todo.valid.token";

  it("service gateways are only accessible via the private API", async ({
    cloudfront,
  }) => {});
  it("internal domain services are only accessible via the private API", async ({
    cloudfront,
  }) => {});
  it("domain services cannot access other domain service gateways", async ({
    cloudfront,
  }) => {});
  it("domain services cannot access other domain services directly", async ({
    cloudfront,
  }) => {});
});
