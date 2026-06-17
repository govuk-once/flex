import { ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

import type { FlexFunctionProps } from "../types";
import { FlexBaseFunction } from "./flex-base-function";

interface FlexPrivateIsolatedFunctionProps extends FlexFunctionProps {
  vpc: IVpc;
  privateIsolatedSg: ISecurityGroup;
}

export class FlexPrivateIsolatedFunction extends FlexBaseFunction {
  constructor(
    scope: Construct,
    id: string,
    { vpc, privateIsolatedSg, ...props }: FlexPrivateIsolatedFunctionProps,
  ) {
    super(scope, id, props, {
      vpc,
      securityGroups: [privateIsolatedSg],
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
    });
  }
}
