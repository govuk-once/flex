import { GovUkOnceStack } from "@platform/gov-uk-once";
import {
  InterfaceVpcEndpointAwsService,
  IpAddresses,
  ISecurityGroup,
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import type { Construct } from "constructs";

import { exportVpcDetailsToSsm } from "./outputs";

export class FlexCoreStack extends GovUkOnceStack {
  private createVpc({ enableNat }: { enableNat: boolean }) {
    return new Vpc(this, "Vpc", {
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      natGateways: enableNat ? 3 : 0,
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
  }

  private createSecurityGroups({ vpc }: { vpc: IVpc }) {
    return {
      privateEgress: new SecurityGroup(this, "PrivateEgress", {
        vpc,
        description: "SecurityGroup with allow outbound",
        allowAllOutbound: true,
      }),
      privateIsolated: new SecurityGroup(this, "PrivateIsolated", {
        vpc,
        description: "SecurityGroup with deny outbound",
        allowAllOutbound: false,
      }),
    };
  }

  private addVpcEndpoint({
    name,
    vpc,
    service,
    securityGroup,
  }: {
    name: string;
    vpc: IVpc;
    service: InterfaceVpcEndpointAwsService;
    securityGroup: ISecurityGroup;
  }) {
    const { connections } = vpc.addInterfaceEndpoint(name, {
      service,
      privateDnsEnabled: true,
    });

    for (const { securityGroupId } of connections.securityGroups) {
      securityGroup.addEgressRule(
        Peer.securityGroupId(securityGroupId),
        Port.tcp(443),
        "Allow HTTPS to VPC endpoint",
      );
    }
  }

  constructor(
    scope: Construct,
    { id, enableNat }: { id: string; enableNat: boolean },
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    this.terminationProtection = true;

    const vpc = this.createVpc({ enableNat });

    const securityGroups = this.createSecurityGroups({ vpc });

    this.addVpcEndpoint({
      vpc,
      name: "CloudWatchLogs",
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroup: securityGroups.privateIsolated,
    });

    exportVpcDetailsToSsm(this, {
      vpcId: vpc.vpcId,
      securityGroups: {
        privateEgressId: securityGroups.privateEgress.securityGroupId,
        privateIsolatedId: securityGroups.privateIsolated.securityGroupId,
      },
    });
  }
}
