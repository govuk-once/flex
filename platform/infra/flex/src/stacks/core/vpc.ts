import {
  AclCidr,
  AclTraffic,
  Action,
  IpAddresses,
  NetworkAcl,
  SecurityGroup,
  SubnetType,
  TrafficDirection,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

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
