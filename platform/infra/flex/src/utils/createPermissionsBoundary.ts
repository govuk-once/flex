import { CfnResource } from "aws-cdk-lib";
import type { IRestApi } from "aws-cdk-lib/aws-apigateway";
import { Effect, ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

/**
 * Creates an IAM Managed Policy for use as a permissions boundary on Domain Service and Service Gateway Lambda function roles.
 * This policy includes the baseline permissions required for Lambda execution, allows invoking the Flex private API, and denies
 * direct invocation of Lambda functions to enforce the use of API Gateway.
 *
 * @param scope The scope in which to define this construct.
 * @param id The scoped construct ID.
 * @param privateApi The Flex private API to which Lambda functions are allowed to invoke.
 * @returns The created ManagedPolicy.
 */
export function createPermissionsBoundary(
  scope: Construct,
  id: string,
  privateApi: IRestApi,
): ManagedPolicy {
  const policy = new ManagedPolicy(scope, id, {
    description:
      "Permissions boundary for Flex Domain Service and Service Gateway Lambda roles. Denies lambda:InvokeFunction and restricts execute-api:Invoke to the Flex private API.",
    statements: [
      // These are the baseline permissions that all Lambda functions have.
      new PolicyStatement({
        sid: "AllowLambdaBasicExecution",
        effect: Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      }),
      new PolicyStatement({
        sid: "AllowXRayTracing",
        effect: Effect.ALLOW,
        actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
        resources: ["*"],
      }),
      // Required for Lambdas with VPC configuration
      new PolicyStatement({
        sid: "AllowVpcNetworking",
        effect: Effect.ALLOW,
        actions: [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses",
        ],
        resources: ["*"],
      }),
      // We need these for the platform constructs to be able to grant permissions for secrets, parameters, KMS keys, and STS assume role.
      new PolicyStatement({
        sid: "AllowServiceIntegrations",
        effect: Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:DescribeParameters",
          "ssm:GetParameterHistory",
          "kms:Decrypt",
          "sts:AssumeRole",
        ],
        resources: ["*"],
      }),
      // execute-api:Invoke is restricted to the Flex private API gateway only.
      // Inline policies further scope this down to specific routes and methods.
      new PolicyStatement({
        sid: "AllowFlexPrivateApiInvoke",
        effect: Effect.ALLOW,
        actions: ["execute-api:Invoke"],
        resources: [privateApi.arnForExecuteApi("*", "/*", "*")],
      }),
      new PolicyStatement({
        sid: "DenyDirectLambdaInvoke",
        effect: Effect.DENY,
        actions: ["lambda:InvokeFunction"],
        resources: ["*"],
      }),
    ],
  });

  // Suppress Checkov checks that flag broad resource scopes in this permissions boundary.
  // A permissions boundary intentionally uses wildcard resources — it defines the maximum
  // permissions ceiling, and actual role policies constrain access further. These checks are
  // not meaningful in the context of a permissions boundary policy.
  (policy.node.defaultChild as CfnResource).addMetadata("checkov", {
    skip: [
      {
        id: "CKV_AWS_107",
        comment:
          "Permissions boundary: sts:AssumeRole on * is intentional; identity-based policies constrain the actual scope.",
      },
      {
        id: "CKV_AWS_108",
        comment:
          "Permissions boundary: secretsmanager:GetSecretValue on * is intentional; identity-based policies constrain the actual scope.",
      },
      {
        id: "CKV_AWS_111",
        comment:
          "Permissions boundary: write actions on * are required for Lambda execution baseline; identity-based policies constrain the actual scope.",
      },
    ],
  });

  return policy;
}
