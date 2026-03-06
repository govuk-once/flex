import {
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import {
  CfnReplicationGroup,
  CfnSubnetGroup,
} from "aws-cdk-lib/aws-elasticache";
import { Construct } from "constructs";

function createElastiCacheSecurityGroup(
  scope: Construct,
  {
    vpc,
    securityGroups,
  }: {
    vpc: Vpc;
    securityGroups: SecurityGroup[];
  },
) {
  const cacheSecurityGroup = new SecurityGroup(
    scope,
    "ElastiCacheSecurityGroup",
    {
      vpc,
      description: "SecurityGroup with allow inbound from Redis",
      allowAllOutbound: false,
    },
  );

  for (const { securityGroupId } of securityGroups) {
    cacheSecurityGroup.connections.allowFrom(
      Peer.securityGroupId(securityGroupId),
      Port.tcp(6379),
    );
  }

  cacheSecurityGroup.connections.allowInternally(
    Port.tcp(16379),
    "Cluster Bus",
  );

  return cacheSecurityGroup;
}

export function createElastiCacheCluster(
  scope: Construct,
  {
    vpc,
    securityGroups,
  }: {
    vpc: Vpc;
    securityGroups: SecurityGroup[];
  },
) {
  const cacheSubnetGroup = new CfnSubnetGroup(scope, "CacheSubnetGroup", {
    description: "Subnet group for ElastiCache Redis cluster",
    subnetIds: vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_ISOLATED,
    }).subnetIds,
  });

  const cacheSecurityGroup = createElastiCacheSecurityGroup(scope, {
    vpc,
    securityGroups,
  });

  const cacheCluster = new CfnReplicationGroup(scope, "CacheCluster", {
    engine: "redis",
    cacheNodeType: "cache.t4g.micro",
    replicationGroupDescription: "Flex cache",

    // Cluster config: 1 Shard + 2 Replica per shard
    clusterMode: "disabled",
    numNodeGroups: 1,
    replicasPerNodeGroup: 2,
    automaticFailoverEnabled: true,
    multiAzEnabled: true,

    // NETWORKING & SECURITY
    cacheSubnetGroupName: cacheSubnetGroup.ref,
    securityGroupIds: [cacheSecurityGroup.securityGroupId],
    transitEncryptionEnabled: true,
    atRestEncryptionEnabled: true,
    // authToken: 'super-secret' TODO CKV_AWS_31
  });

  return { cacheCluster };
}
