import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MockIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { describe, expect, it } from "vitest";

import { createPermissionsBoundary } from "./createPermissionsBoundary";

function createBoundaryTemplate() {
  const app = new App();
  const stack = new Stack(app, "TestStack");
  const api = new RestApi(stack, "Api");
  api.root.addMethod("GET", new MockIntegration());

  createPermissionsBoundary(stack, "Boundary", api);

  return Template.fromStack(stack);
}

interface PolicyResource {
  Properties: {
    Description: string;
    PolicyDocument: {
      Statement: Record<string, unknown>[];
    };
  };
}

function findBoundaryStatements(template: Template) {
  const policies = template.findResources("AWS::IAM::ManagedPolicy");
  const policy = Object.values(policies).find(
    (p) =>
      (p as PolicyResource).Properties.Description.includes(
        "Permissions boundary",
      ),
  ) as PolicyResource | undefined;

  return policy?.Properties.PolicyDocument.Statement ?? [];
}

function findStatement(statements: Record<string, unknown>[], sid: string) {
  return statements.find((s) => s.Sid === sid);
}

describe("createPermissionsBoundary", () => {
  const template = createBoundaryTemplate();
  const statements = findBoundaryStatements(template);

  it("includes DenyDirectLambdaInvoke statement", () => {
    const statement = findStatement(statements, "DenyDirectLambdaInvoke");

    expect(statement).toBeDefined();
    expect(statement?.Effect).toBe("Deny");
    expect(statement?.Action).toBe("lambda:InvokeFunction");
    expect(statement?.Resource).toBe("*");
  });

  it("includes DenyIamActions statement denying iam:*", () => {
    const statement = findStatement(statements, "DenyIamActions");

    expect(statement).toBeDefined();
    expect(statement?.Effect).toBe("Deny");
    expect(statement?.Action).toBe("iam:*");
    expect(statement?.Resource).toBe("*");
  });

  it("includes DenyLambdaReconfig statement", () => {
    const statement = findStatement(statements, "DenyLambdaReconfig");

    expect(statement).toBeDefined();
    expect(statement?.Effect).toBe("Deny");
    expect(statement?.Action).toEqual(
      expect.arrayContaining([
        "lambda:CreateFunction",
        "lambda:UpdateFunctionConfiguration",
        "lambda:UpdateFunctionCode",
        "lambda:AddPermission",
      ]),
    );
    expect(statement?.Resource).toBe("*");
  });

  it("restricts execute-api:Invoke to the private API", () => {
    const statement = findStatement(statements, "AllowFlexPrivateApiInvoke");

    expect(statement).toBeDefined();
    expect(statement?.Effect).toBe("Allow");
    expect(statement?.Action).toBe("execute-api:Invoke");
  });
});
