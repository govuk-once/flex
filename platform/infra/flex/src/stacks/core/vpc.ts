import {
  IpAddresses,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export function createVpc(scope: Construct) {
  const vpc = new Vpc(scope, "Vpc", {
    ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
    natGateways: 3,
    availabilityZones: ["eu-west-2a", "eu-west-2b", "eu-west-2c"],
    subnetConfiguration: [
      {
        name: "Public",
        subnetType: SubnetType.PUBLIC,
        cidrMask: 24,
      },
      {
        name: "PrivateEgress",
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 19,
      },
      {
        name: "PrivateIsolated",
        subnetType: SubnetType.PRIVATE_ISOLATED,
        cidrMask: 19,
      },
    ],
  });

  const privateEgress = new SecurityGroup(scope, "PrivateEgress", {
    vpc,
    description: "SecurityGroup with allow outbound",
    allowAllOutbound: true,
  });

  const privateIsolated = new SecurityGroup(scope, "PrivateIsolated", {
    vpc,
    description: "SecurityGroup with deny outbound",
    allowAllOutbound: false,
  });

  return {
    vpc,
    securityGroups: {
      privateEgress,
      privateIsolated,
    },
  };
}
