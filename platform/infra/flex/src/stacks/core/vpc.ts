import { Stack } from "aws-cdk-lib";
import {
  AclCidr,
  AclTraffic,
  Action,
  FlowLogDestination,
  FlowLogFileFormat,
  FlowLogMaxAggregationInterval,
  FlowLogTrafficType,
  IpAddresses,
  IVpc,
  LogFormat,
  NetworkAcl,
  SecurityGroup,
  SubnetType,
  TrafficDirection,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

import { FlowLogBucket } from "../../constructs/s3/FlowLogBucket";

function addInboundDenies90to100(prefix: string, nacl: NetworkAcl) {
  nacl.addEntry(`${prefix}DenyInboundSystemPortsTcp`, {
    ruleNumber: 90,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.tcpPortRange(0, 1023),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.DENY,
  });

  nacl.addEntry(`${prefix}DenyInboundSystemPortsUdp`, {
    ruleNumber: 91,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.udpPortRange(0, 1023),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.DENY,
  });

  nacl.addEntry(`${prefix}DenyInboundRdp`, {
    ruleNumber: 92,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.tcpPort(3389),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.DENY,
  });
}

function addVpcLoopback80(prefix: string, nacl: NetworkAcl, vpc: Vpc) {
  nacl.addEntry(`${prefix}AllowOutboundToVpc`, {
    ruleNumber: 80,
    cidr: AclCidr.ipv4(vpc.vpcCidrBlock),
    traffic: AclTraffic.allTraffic(),
    direction: TrafficDirection.EGRESS,
    ruleAction: Action.ALLOW,
  });

  nacl.addEntry(`${prefix}AllowInboundFromVpc`, {
    ruleNumber: 80,
    cidr: AclCidr.ipv4(vpc.vpcCidrBlock),
    traffic: AclTraffic.allTraffic(),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.ALLOW,
  });
}

function allowEphemeralReturn200to300(prefix: string, nacl: NetworkAcl) {
  nacl.addEntry(`${prefix}AllowInboundEphemeralReturn`, {
    ruleNumber: 200,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.tcpPortRange(1024, 65535),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.ALLOW,
  });

  nacl.addEntry(`${prefix}AllowInboundEphemeralReturnUdp`, {
    ruleNumber: 210,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.udpPortRange(1024, 65535),
    direction: TrafficDirection.INGRESS,
    ruleAction: Action.ALLOW,
  });
}

function allowAllOutbound32000(prefix: string, nacl: NetworkAcl) {
  nacl.addEntry(`${prefix}AllowAllOutbound`, {
    ruleNumber: 32000,
    cidr: AclCidr.anyIpv4(),
    traffic: AclTraffic.allTraffic(),
    direction: TrafficDirection.EGRESS,
    ruleAction: Action.ALLOW,
  });
}

function applyPublicRules(scope: Construct, vpc: Vpc) {
  const prefix = "Public";

  const publicNacl = new NetworkAcl(scope, `${prefix}Nacl`, {
    vpc,
    subnetSelection: { subnetType: SubnetType.PUBLIC },
  });

  addVpcLoopback80(prefix, publicNacl, vpc);
  addInboundDenies90to100(prefix, publicNacl);
  allowEphemeralReturn200to300(prefix, publicNacl);
  allowAllOutbound32000(prefix, publicNacl);
}

function applyPrivateEgressRules(scope: Construct, vpc: Vpc) {
  const prefix = "PrivateEgress";

  const privateEgressNacl = new NetworkAcl(scope, `${prefix}Nacl`, {
    vpc,
    subnetSelection: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
  });

  addVpcLoopback80(prefix, privateEgressNacl, vpc);
  addInboundDenies90to100(prefix, privateEgressNacl);
  allowEphemeralReturn200to300(prefix, privateEgressNacl);
  allowAllOutbound32000(prefix, privateEgressNacl);
}

function applyPrivateIsolatedRules(scope: Construct, vpc: Vpc) {
  const prefix = "PrivateIsolated";

  const privateIsolatedNacl = new NetworkAcl(scope, `${prefix}Nacl`, {
    vpc,
    subnetSelection: { subnetType: SubnetType.PRIVATE_ISOLATED },
  });

  addVpcLoopback80(prefix, privateIsolatedNacl, vpc);
  addInboundDenies90to100(prefix, privateIsolatedNacl);
}

// Enables VPC-wide flow logs to a dedicated, KMS-encrypted S3 bucket.
function createFlowLogs(scope: Construct, vpc: IVpc) {
  const stack = Stack.of(scope);

  const flowLogKey = new Key(scope, "FlowLogKey", {
    alias: "alias/flex-vpc-flow-logs-key",
    description: "KMS key for VPC flow log encryption",
    enableKeyRotation: true,
  });

  // Only grants the write path used by log delivery. Read access
  // (kms:Decrypt) is intentionally not granted to any role here - grant it to
  // a specific role in a follow-up once a reader (e.g. an investigator role
  // or Athena) is needed.
  flowLogKey.addToResourcePolicy(
    new PolicyStatement({
      sid: "AllowVpcFlowLogDelivery",
      effect: Effect.ALLOW,
      principals: [new ServicePrincipal("delivery.logs.amazonaws.com")],
      actions: ["kms:Encrypt", "kms:GenerateDataKey*", "kms:DescribeKey"],
      resources: ["*"],
      conditions: {
        StringEquals: { "aws:SourceAccount": stack.account },
        ArnLike: {
          "aws:SourceArn": stack.formatArn({ service: "logs", resource: "*" }),
        },
      },
    }),
  );

  const { bucket } = new FlowLogBucket(scope, "FlowLogBucket", flowLogKey);

  vpc.addFlowLog("FlowLog", {
    destination: FlowLogDestination.toS3(bucket, undefined, {
      fileFormat: FlowLogFileFormat.PLAIN_TEXT,
    }),
    trafficType: FlowLogTrafficType.ALL,
    maxAggregationInterval: FlowLogMaxAggregationInterval.ONE_MINUTE,
    logFormat: [
      LogFormat.ALL_DEFAULT_FIELDS,
      LogFormat.VPC_ID,
      LogFormat.SUBNET_ID,
      LogFormat.INSTANCE_ID,
      LogFormat.TCP_FLAGS,
      LogFormat.PKT_SRC_ADDR,
      LogFormat.PKT_DST_ADDR,
      LogFormat.FLOW_DIRECTION,
    ],
  });
}

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

  applyPublicRules(scope, vpc);
  applyPrivateEgressRules(scope, vpc);
  applyPrivateIsolatedRules(scope, vpc);
  createFlowLogs(scope, vpc);

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
