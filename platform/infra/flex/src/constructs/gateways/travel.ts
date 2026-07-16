import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

import { createPrivateGatewayRoute } from "../../utils/createPrivateGatewayRoute";
import { getPlatformEntry } from "../../utils/getEntry";
import { AlarmActionProps } from "../alarms/types";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

interface TravelServiceGatewayProps extends AlarmActionProps {
  gatewaysResource: IResource;
  privateEgressSg: ISecurityGroup;
  vpc: IVpc;
}

export function createTravelServiceGateway(
  scope: Construct,
  {
    gatewaysResource,
    privateEgressSg,
    vpc,
    criticalAction,
    warningAction,
  }: TravelServiceGatewayProps,
) {
  const travelServiceGateway = new FlexPrivateEgressFunction(
    scope,
    "travelServiceGateway",
    {
      entry: getPlatformEntry("travel", "handlers/service-gateway.ts"),
      domain: "travel",
      timeout: Duration.seconds(30),
      privateEgressSg,
      vpc,
      criticalAction,
      warningAction,
    },
  );

  createPrivateGatewayRoute(
    "travel/{proxy+}",
    "ANY",
    travelServiceGateway.function,
    gatewaysResource,
  );
}
