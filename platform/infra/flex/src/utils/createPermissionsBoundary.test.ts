import { App, type CfnElement, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MockIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { describe, expect, it } from "vitest";

import { createPermissionsBoundary } from "./createPermissionsBoundary";

interface PolicyStatementJson {
  Sid?: string;
  Effect: string;
  Action: string | string[];
  Resource: unknown;
}

interface PolicyResource {
  Properties: {
    PolicyDocument: {
      Statement: PolicyStatementJson[];
    };
  };
}

function synthesiseBoundary() {
  const app = new App();
  const stack = new Stack(app, "TestStack");
  const api = new RestApi(stack, "Api");
  api.root.addMethod("GET", new MockIntegration());

  const policy = createPermissionsBoundary(stack, "Boundary", api);
  const logicalId = stack.getLogicalId(policy.node.defaultChild as CfnElement);
  const boundary = Template.fromStack(stack).findResources(
    "AWS::IAM::ManagedPolicy",
  )[logicalId] as PolicyResource;

  return {
    statements: boundary.Properties.PolicyDocument.Statement,
    privateApiArn: stack.resolve(
      api.arnForExecuteApi("*", "/*", "*"),
    ) as unknown,
  };
}

describe("createPermissionsBoundary", () => {
  const { statements, privateApiArn } = synthesiseBoundary();

  it.each([
    { sid: "DenyDirectLambdaInvoke", action: "lambda:InvokeFunction" },
    { sid: "DenyIamActions", action: "iam:*" },
    {
      sid: "DenyLambdaReconfig",
      action: [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionConfiguration",
        "lambda:UpdateFunctionCode",
        "lambda:AddPermission",
      ],
    },
  ])("$sid denies on every resource without conditions", ({ sid, action }) => {
    expect(statements.filter(({ Sid }) => Sid === sid)).toEqual([
      { Sid: sid, Effect: "Deny", Action: action, Resource: "*" },
    ]);
  });

  it("allows execute-api:Invoke on the private API only", () => {
    expect(
      statements.filter(({ Action }) =>
        [Action].flat().some((action) => action.startsWith("execute-api:")),
      ),
    ).toEqual([
      {
        Sid: "AllowFlexPrivateApiInvoke",
        Effect: "Allow",
        Action: "execute-api:Invoke",
        Resource: privateApiArn,
      },
    ]);
  });
});
