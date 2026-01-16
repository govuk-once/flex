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
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import type { Construct } from "constructs";

import { exportRedisEndpointToSsm, exportVpcDetailsToSsm } from "./outputs";

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

  private createElasticacheSecurityGroup({
    vpc,
    lambdaSecurityGroup,
  }: {
    vpc: IVpc;
    lambdaSecurityGroup: ISecurityGroup;
  }) {
    const securityGroup = new SecurityGroup(this, "ElasticacheSecurityGroup", {
      vpc,
      description: "SecurityGroup with allow inbound from Redis",
      allowAllOutbound: false,
    });

    // INBOUND: Allow Lambda to talk to Cache
    securityGroup.addIngressRule(
      Peer.securityGroupId(lambdaSecurityGroup.securityGroupId),
      Port.tcp(6379),
      "Allow inbound from Authorizer Lambda",
    );

    // INBOUND: Allow nodes to RECEIVE traffic from each other
    securityGroup.connections.allowFrom(
      securityGroup,
      Port.allTcp(),
      "Allow Redis nodes to talk to each other (Cluster Bus)",
    );

    // OUTBOUND: Allow nodes to SEND traffic to each other
    // (This is the rule you must add if allowAllOutbound is false)
    securityGroup.connections.allowTo(
      securityGroup,
      Port.allTcp(),
      "Allow Outbound to Self (Cluster Gossip)",
    );

    return securityGroup;
  }

  private createElasticacheCluster({
    vpc,
    securityGroupIds,
  }: {
    vpc: IVpc;
    securityGroupIds: string[];
  }) {
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "CacheSubnetGroup",
      {
        description: "Subnet group for ElastiCache Redis cluster",
        subnetIds: vpc.selectSubnets({
          subnetType: SubnetType.PRIVATE_ISOLATED,
        }).subnetIds,
      },
    );

    const cluster = new elasticache.CfnReplicationGroup(this, "AuthCluster", {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",

      // CLUSTER MODE CONFIG
      replicationGroupDescription: "Flex authentication cache",
      numCacheClusters: 3,

      // HIGH AVAILABILITY SETTINGS
      multiAzEnabled: true, // Required for SLA and automatic failover
      automaticFailoverEnabled: true, // AWS promotes a replica if primary dies

      // NETWORKING & SECURITY
      cacheSubnetGroupName: cacheSubnetGroup.ref, // MUST contain subnets in 3 AZs
      securityGroupIds,
      transitEncryptionEnabled: true,
      atRestEncryptionEnabled: true,
      // TODO: add auth token CKV_AWS_31
    });

    return cluster;
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

    // Create ElastiCache cluster for authentication
    const elasticacheSecurityGroup = this.createElasticacheSecurityGroup({
      vpc,
      lambdaSecurityGroup: securityGroups.privateEgress,
    });

    const cacheCluster = this.createElasticacheCluster({
      vpc,
      securityGroupIds: [elasticacheSecurityGroup.securityGroupId],
    });

    exportRedisEndpointToSsm(this, {
      endpoint: cacheCluster.attrPrimaryEndPointAddress,
    });
  }
}
