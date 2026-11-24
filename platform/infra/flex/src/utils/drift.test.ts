import { describe, expect, it } from "vitest";

import { driftAllowlist } from "../drift-allowlist";
import {
  filterDrift,
  isBlockingStackStatus,
  type ResourceDrift,
  unprefixedStackName,
} from "./drift";

function stageDrift(logicalId: string): ResourceDrift {
  return {
    logicalId,
    resourceType: "AWS::ApiGateway::Stage",
    status: "MODIFIED",
    differences: [
      { propertyPath: "/DeploymentId", expected: "tbr7nk", actual: "p322mj" },
    ],
  };
}

describe("filterDrift", () => {
  it("drops the FlexPlatform stage DeploymentId drift", () => {
    const drifts = [
      stageDrift("ApiDeploymentStageprod3EB9684E"),
      stageDrift("PrivateGatewayDeploymentStageprodC0187B9E"),
    ];

    expect(filterDrift("FlexPlatform", drifts, driftAllowlist)).toEqual([]);
  });

  it("keeps drift on resources that are not allowlisted", () => {
    const policy: ResourceDrift = {
      logicalId: "PrivateGateway81215152",
      resourceType: "AWS::ApiGateway::RestApi",
      status: "MODIFIED",
      differences: [{ propertyPath: "/Policy", expected: "a", actual: "b" }],
    };

    expect(filterDrift("FlexPlatform", [policy], driftAllowlist)).toEqual([
      policy,
    ]);
  });

  it("only applies entries to their own stack", () => {
    const drifts = [stageDrift("ApiDeploymentStageprod3EB9684E")];

    expect(filterDrift("uns", drifts, driftAllowlist)).toEqual(drifts);
  });

  it("keeps the differences that are not allowlisted", () => {
    const drift: ResourceDrift = {
      ...stageDrift("ApiDeploymentStageprod3EB9684E"),
      differences: [
        { propertyPath: "/DeploymentId", expected: "a", actual: "b" },
        { propertyPath: "/TracingEnabled", expected: "true", actual: "false" },
      ],
    };

    expect(filterDrift("FlexPlatform", [drift], driftAllowlist)).toEqual([
      {
        ...drift,
        differences: [
          {
            propertyPath: "/TracingEnabled",
            expected: "true",
            actual: "false",
          },
        ],
      },
    ]);
  });

  it("never drops a deleted resource", () => {
    const deleted: ResourceDrift = {
      logicalId: "ApiDeploymentStageprod3EB9684E",
      resourceType: "AWS::ApiGateway::Stage",
      status: "DELETED",
      differences: [],
    };

    expect(filterDrift("FlexPlatform", [deleted], driftAllowlist)).toEqual([
      deleted,
    ]);
  });
});

describe("isBlockingStackStatus", () => {
  it.for([
    ["UPDATE_ROLLBACK_FAILED", true],
    ["ROLLBACK_COMPLETE", true],
    ["UPDATE_IN_PROGRESS", true],
    ["UPDATE_COMPLETE", false],
    ["UPDATE_ROLLBACK_COMPLETE", false],
    ["CREATE_COMPLETE", false],
  ] as const)("%s -> %s", ([status, expected]) => {
    expect(isBlockingStackStatus(status)).toBe(expected);
  });
});

describe("unprefixedStackName", () => {
  it("strips the stage prefix", () => {
    expect(unprefixedStackName("production-FlexPlatform", "production")).toBe(
      "FlexPlatform",
    );
  });

  it("leaves other names alone", () => {
    expect(unprefixedStackName("FlexPlatform", "production")).toBe(
      "FlexPlatform",
    );
  });
});
