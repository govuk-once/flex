import { describe, expect, it } from "vitest";

import { driftAllowlist } from "../drift-allowlist";
import {
  type DriftContext,
  filterDrift,
  isBlockingStackStatus,
  type ResourceDrift,
  unprefixedStackName,
} from "./drift";

const context: DriftContext = { region: "eu-west-2", account: "123456789012" };

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

    expect(
      filterDrift("FlexPlatform", drifts, driftAllowlist, context),
    ).toEqual([]);
  });

  it("keeps drift on resources that are not allowlisted", () => {
    const bucket: ResourceDrift = {
      logicalId: "SomeBucket",
      resourceType: "AWS::S3::Bucket",
      status: "MODIFIED",
      differences: [
        {
          propertyPath: "/VersioningConfiguration",
          expected: "a",
          actual: "b",
        },
      ],
    };

    expect(
      filterDrift("FlexPlatform", [bucket], driftAllowlist, context),
    ).toEqual([bucket]);
  });

  it("only applies entries to their own stack", () => {
    const drifts = [stageDrift("ApiDeploymentStageprod3EB9684E")];

    expect(filterDrift("uns", drifts, driftAllowlist, context)).toEqual(drifts);
  });

  it("keeps the differences that are not allowlisted", () => {
    const drift: ResourceDrift = {
      ...stageDrift("ApiDeploymentStageprod3EB9684E"),
      differences: [
        { propertyPath: "/DeploymentId", expected: "a", actual: "b" },
        { propertyPath: "/TracingEnabled", expected: "true", actual: "false" },
      ],
    };

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([
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

    expect(
      filterDrift("FlexPlatform", [deleted], driftAllowlist, context),
    ).toEqual([deleted]);
  });
});

describe("filterDrift private gateway policy", () => {
  const apiId = "of8z3zof84";
  const fullArn = `arn:aws:execute-api:eu-west-2:123456789012:${apiId}/*`;

  function policy(resource: string, sourceVpce = "vpce-0fda65abeaa732a68") {
    return JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Deny",
          Principal: { AWS: "*" },
          Action: "execute-api:Invoke",
          Resource: resource,
          Condition: { StringNotEquals: { "aws:SourceVpce": sourceVpce } },
        },
      ],
    });
  }

  function policyDrift(
    expected: string,
    actual: string,
    physicalId: string | undefined = apiId,
  ): ResourceDrift {
    return {
      logicalId: "PrivateGateway81215152",
      physicalId,
      resourceType: "AWS::ApiGateway::RestApi",
      status: "MODIFIED",
      differences: [{ propertyPath: "/Policy", expected, actual }],
    };
  }

  it("drops the shorthand being stored as the API's own ARN", () => {
    const drift = policyDrift(policy("execute-api:/*"), policy(fullArn));

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([]);
  });

  it("drops the wildcard API ID being stored as the API's own ID", () => {
    const drift = policyDrift(
      policy("arn:aws:execute-api:eu-west-2:123456789012:*/*"),
      policy(fullArn),
    );

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([]);
  });

  it("ignores key order and whitespace", () => {
    const actual = JSON.stringify(
      {
        Statement: [
          {
            Condition: {
              StringNotEquals: { "aws:SourceVpce": "vpce-0fda65abeaa732a68" },
            },
            Resource: fullArn,
            Action: "execute-api:Invoke",
            Principal: { AWS: "*" },
            Effect: "Deny",
          },
        ],
        Version: "2012-10-17",
      },
      undefined,
      2,
    );
    const drift = policyDrift(policy("execute-api:/*"), actual);

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([]);
  });

  it.for([
    ["a different VPC endpoint", policy(fullArn, "vpce-attacker")],
    [
      "a different API ID",
      policy("arn:aws:execute-api:eu-west-2:123456789012:other/*"),
    ],
    [
      "a different account",
      policy(`arn:aws:execute-api:eu-west-2:999999999999:${apiId}/*`),
    ],
    [
      "an Allow instead of a Deny",
      policy(fullArn).replace('"Deny"', '"Allow"'),
    ],
    ["a removed policy", "null"],
  ] as const)("keeps drift to %s", ([, actual]) => {
    const drift = policyDrift(policy("execute-api:/*"), actual);

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([drift]);
  });

  it("keeps drift when the physical ID is unknown", () => {
    const drift = policyDrift(policy("execute-api:/*"), policy(fullArn), "");

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([drift]);
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
