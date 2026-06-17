import { ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

import type { FlexFunctionProps } from "../types";
import { FlexBaseFunction } from "./flex-base-function";

interface FlexPrivateEgressFunctionProps extends FlexFunctionProps {
  vpc: IVpc;
  privateEgressSg: ISecurityGroup;
}

export class FlexPrivateEgressFunction extends FlexBaseFunction {
  constructor(
    scope: Construct,
    id: string,
    { vpc, privateEgressSg, ...props }: FlexPrivateEgressFunctionProps,
  ) {
    super(scope, id, props, {
      vpc,
      securityGroups: [privateEgressSg],
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    });
  }
}
