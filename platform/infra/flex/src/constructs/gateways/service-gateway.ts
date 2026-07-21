import type { ValidatedGatewayConfig } from "@flex/service-gateway";
import type { RouteAccess } from "@flex/utils";
import { assertNever } from "@flex/utils";
import { Duration } from "aws-cdk-lib";
import type { IResource } from "aws-cdk-lib/aws-apigateway";
import type { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getFlexParamName, getPlatformEntry } from "../../utils/getEntry";
import { toPascalCase } from "../../utils/routes";
import type { AlarmActionProps } from "../alarms/types";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../lambda/flex-private-isolated-function";
import type { FlexFunctionProps } from "../types";

interface SecurityGroups {
  readonly private: ISecurityGroup;
  readonly isolated: ISecurityGroup;
}

interface CreateServiceGatewayOptions extends AlarmActionProps {
  readonly config: ValidatedGatewayConfig;
  readonly gatewaysResource: IResource;
  readonly importValue: (key: string) => string;
  readonly securityGroups: SecurityGroups;
  readonly vpc: IVpc;
}

export function createServiceGateway(
  scope: Construct,
  {
    config,
    gatewaysResource,
    importValue,
    securityGroups,
    vpc,
    criticalAction,
    warningAction,
  }: CreateServiceGatewayOptions,
) {
  const serviceGateway = createFunction(scope, {
    access: config.access,
    id: `${toPascalCase(config.name)}ServiceGateway`,
    enableDefaultAlarms: config.function?.enableDefaultAlarms,
    securityGroups,
    functionProps: {
      domain: config.name,
      entry: getPlatformEntry(config.name, "gateway.ts"),
      timeout: Duration.seconds(30),
      vpc,
      criticalAction,
      warningAction,
    },
  });

  grantResources(serviceGateway, serviceGateway.function, {
    importValue,
    resources: config.resources,
  });

  const method = "ANY";
  const path = `${config.name}/{proxy+}`;

  createPrivateGatewayRoute(
    path,
    method,
    serviceGateway.function,
    gatewaysResource,
  );

  return { method, path };
}

interface FunctionProps extends FlexFunctionProps {
  readonly vpc: IVpc;
}

interface CreateFunctionOptions {
  readonly id: string;
  readonly access: RouteAccess;
  readonly functionProps: FunctionProps;
  readonly securityGroups: SecurityGroups;
  readonly enableDefaultAlarms?: boolean;
}

function createFunction(
  scope: Construct,
  {
    id,
    access,
    enableDefaultAlarms,
    functionProps,
    securityGroups,
  }: CreateFunctionOptions,
): FlexPrivateEgressFunction | FlexPrivateIsolatedFunction {
  switch (access) {
    case "isolated":
      return new FlexPrivateIsolatedFunction(scope, id, {
        ...functionProps,
        privateIsolatedSg: securityGroups.isolated,
      });
    case "private":
      return new FlexPrivateEgressFunction(scope, id, {
        ...functionProps,
        privateEgressSg: securityGroups.private,
        enableDefaultAlarms,
      });
    case "public":
      throw new Error(`Unsupported route access: "${access}"`);
    default:
      return assertNever(access);
  }
}

interface GrantResourcesOptions {
  readonly importValue: (key: string) => string;
  readonly resources: ValidatedGatewayConfig["resources"];
}

function grantResources(
  scope: Construct,
  target: NodejsFunction,
  { importValue, resources }: GrantResourcesOptions,
) {
  for (const [key, resource] of Object.entries(resources)) {
    const arn = importValue(getFlexParamName(resource.path));

    switch (resource.type) {
      case "kms":
        Key.fromKeyArn(scope, `Key${toPascalCase(key)}`, arn).grantDecrypt(
          target,
        );
        break;
      case "role":
        target.addToRolePolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["sts:AssumeRole"],
            resources: [arn],
          }),
        );
        break;
      case "secret":
        target.addEnvironment(resource.env, arn);
        target.addToRolePolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [arn],
          }),
        );
        break;
      case "ssm":
        throw new Error(`Not yet implemented: "${resource.type}"`);
      default:
        return assertNever(resource);
    }
  }
}
