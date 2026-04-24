import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

interface ServiceGatewayProps {
  consumerConfigArn: string;
  gatewaysResource: IResource;
  privateEgressSg: ISecurityGroup;
  secretArnEnvVarName: string;
  service: string;
  vpc: IVpc;
}

export function createServiceGateway(
  scope: Construct,
  {
    consumerConfigArn,
    gatewaysResource,
    privateEgressSg,
    secretArnEnvVarName,
    service,
    vpc,
  }: ServiceGatewayProps,
) {
  const serviceGateway = new FlexPrivateEgressFunction(
    scope,
    `${service}ServiceGateway`,
    {
      entry: getPlatformEntry(service, "handlers/service-gateway.ts"),
      domain: service,
      environment: {
        [secretArnEnvVarName]: consumerConfigArn,
      },
      timeout: Duration.seconds(30),
      privateEgressSg,
      vpc,
    },
  );

  serviceGateway.function.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [consumerConfigArn],
    }),
  );

  createPrivateGatewayRoute(
    `${service}/{proxy+}`,
    "ANY",
    serviceGateway.function,
    gatewaysResource,
  );
}
