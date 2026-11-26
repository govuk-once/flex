import { describe, expect, it } from "vitest";

import { driftAllowlist } from "../drift-allowlist";
import {
  type DriftContext,
  filterDrift,
  fromDetection,
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

  it("keeps a deleted resource that only has property entries", () => {
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

describe("filterDrift Shield Anti-DDoS rule", () => {
  const shieldRule = {
    Name: "AWSManagedRulesAntiDDoSRuleSet",
    OverrideAction: { None: {} },
    Priority: 10000001,
    Statement: {
      ManagedRuleGroupStatement: {
        Name: "AWSManagedRulesAntiDDoSRuleSet",
        VendorName: "AWS",
      },
    },
    VisibilityConfig: {
      CloudWatchMetricsEnabled: true,
      MetricName: "AWSManagedRulesAntiDDoSRuleSet",
      SampledRequestsEnabled: false,
    },
  };

  function aclDrift(
    propertyPath: string,
    actual: string | undefined,
    expected?: string,
  ): ResourceDrift {
    return {
      logicalId: "CfWebAcl",
      resourceType: "AWS::WAFv2::WebACL",
      status: "MODIFIED",
      differences: [{ propertyPath, expected, actual }],
    };
  }

  it.for(["/Rules/6", "/Rules/7"])(
    "drops the rule Shield adds at %s",
    (path) => {
      const drift = aclDrift(path, JSON.stringify(shieldRule));

      expect(
        filterDrift("FlexGlobal", [drift], driftAllowlist, context),
      ).toEqual([]);
    },
  );

  it("drops the rule when expected is reported as the string null", () => {
    const drift = aclDrift("/Rules/6", JSON.stringify(shieldRule), "null");

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [],
    );
  });

  it("drops the rule whatever action and visibility config Shield sets", () => {
    const drift = aclDrift(
      "/Rules/6",
      JSON.stringify({
        ...shieldRule,
        OverrideAction: { Count: {} },
        VisibilityConfig: { ...shieldRule.VisibilityConfig, MetricName: "x" },
      }),
    );

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [],
    );
  });

  it("drops the rule when Shield adds fields to its statement", () => {
    const drift = aclDrift(
      "/Rules/6",
      JSON.stringify({
        ...shieldRule,
        Statement: {
          ManagedRuleGroupStatement: {
            ...shieldRule.Statement.ManagedRuleGroupStatement,
            ManagedRuleGroupConfigs: [{ AWSManagedRulesAntiDDoSRuleSet: {} }],
          },
        },
      }),
    );

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [],
    );
  });

  it("keeps an added value that is not JSON", () => {
    const drift = aclDrift("/Rules/6", "not json");

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [drift],
    );
  });

  it.for([
    ["a different rule name", { ...shieldRule, Name: "SomethingElse" }],
    ["a template priority", { ...shieldRule, Priority: 6 }],
    ["no priority", { ...shieldRule, Priority: undefined }],
    [
      "a different rule group",
      {
        ...shieldRule,
        Statement: {
          ManagedRuleGroupStatement: {
            Name: "AWSManagedRulesCommonRuleSet",
            VendorName: "AWS",
          },
        },
      },
    ],
    [
      "a different vendor",
      {
        ...shieldRule,
        Statement: {
          ManagedRuleGroupStatement: {
            ...shieldRule.Statement.ManagedRuleGroupStatement,
            VendorName: "Someone",
          },
        },
      },
    ],
    [
      "an allow rule",
      {
        Name: "AWSManagedRulesAntiDDoSRuleSet",
        Priority: 10000001,
        Action: { Allow: {} },
        Statement: { ByteMatchStatement: {} },
      },
    ],
  ] as const)("keeps an added rule with %s", ([, rule]) => {
    const drift = aclDrift("/Rules/6", JSON.stringify(rule));

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [drift],
    );
  });

  it("keeps a change to a rule the template declares", () => {
    const drift = aclDrift(
      "/Rules/0",
      JSON.stringify(shieldRule),
      JSON.stringify({ ...shieldRule, Priority: 0 }),
    );

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [drift],
    );
  });

  it("keeps a removed rule", () => {
    const drift = aclDrift("/Rules/6", undefined, JSON.stringify(shieldRule));

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [drift],
    );
  });

  it("keeps drift on other web ACL properties", () => {
    const drift = aclDrift("/DefaultAction", '{"Block":{}}', '{"Allow":{}}');

    expect(filterDrift("FlexGlobal", [drift], driftAllowlist, context)).toEqual(
      [drift],
    );
  });

  it("only applies to the CloudFront web ACL", () => {
    const drift = {
      ...aclDrift("/Rules/6", JSON.stringify(shieldRule)),
      logicalId: "ApiWebAcl",
    };

    expect(
      filterDrift("FlexPlatform", [drift], driftAllowlist, context),
    ).toEqual([drift]);
  });
});

describe("filterDrift deleted resources", () => {
  const deletedAlarm = (logicalId: string): ResourceDrift => ({
    logicalId,
    resourceType: "AWS::CloudWatch::Alarm",
    status: "DELETED",
    differences: [],
  });

  it("drops the deleted Shield alarms", () => {
    expect(
      filterDrift(
        "FlexGlobal",
        [
          deletedAlarm("CloudfrontShieldAlarmsDDoSDetected3029FCB9"),
          deletedAlarm(
            "CloudfrontShieldAlarmsDDoSAttackRequestsPerSecond3D89A18F", // pragma: allowlist secret
          ),
        ],
        driftAllowlist,
        context,
      ),
    ).toEqual([]);
  });

  it("keeps other deleted resources in the same stack", () => {
    const deleted = deletedAlarm("AlarmsTrafficCliff7C7B8676");

    expect(
      filterDrift("FlexGlobal", [deleted], driftAllowlist, context),
    ).toEqual([deleted]);
  });

  it("only applies to its own stack", () => {
    const deleted = deletedAlarm("CloudfrontShieldAlarmsDDoSDetected3029FCB9");

    expect(filterDrift("FlexCore", [deleted], driftAllowlist, context)).toEqual(
      [deleted],
    );
  });

  it("does not allow modifying the resource", () => {
    const modified: ResourceDrift = {
      ...deletedAlarm("CloudfrontShieldAlarmsDDoSDetected3029FCB9"),
      status: "MODIFIED",
      differences: [{ propertyPath: "/Threshold", expected: "1", actual: "5" }],
    };

    expect(
      filterDrift("FlexGlobal", [modified], driftAllowlist, context),
    ).toEqual([modified]);
  });
});

describe("fromDetection", () => {
  const detectedAt = new Date("2026-11-26T14:04:33.802Z");
  const drift = (logicalId: string, timestamp?: Date): ResourceDrift => ({
    logicalId,
    resourceType: "AWS::Events::Rule",
    status: "MODIFIED",
    differences: [],
    timestamp,
  });

  it("drops records from an earlier detection", () => {
    const stale = drift(
      "KmsKeyChangeRuleAE44FD84",
      new Date("2026-11-24T15:31:01.800Z"),
    );
    const current = drift("CfWebAcl", new Date("2026-11-26T14:04:38.309Z"));

    expect(fromDetection([stale, current], detectedAt)).toEqual([current]);
  });

  it("keeps records without a timestamp", () => {
    const undated = drift("CfWebAcl");

    expect(fromDetection([undated], detectedAt)).toEqual([undated]);
  });

  it("keeps every record when the detection time is unknown", () => {
    const stale = drift(
      "KmsKeyChangeRuleAE44FD84",
      new Date("2026-11-24T15:31:01.800Z"),
    );

    expect(fromDetection([stale])).toEqual([stale]);
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
