import { importVpcDetailsFromSsm } from "@platform/core/outputs";
import { importAuthParametersFromSsm } from "@platform/parameter/outputs";
import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { SsmKeys } from "../outputs";
import { getPlatformEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

  public readonly cacheCluster: elasticache.CfnReplicationGroup;

  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  private redisEndpointParameter: ssm.StringParameter;
  private userPoolId: ssm.IStringParameter;
  private clientId: ssm.IStringParameter;

  private readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpcDetails = importVpcDetailsFromSsm(this);
    this.vpc = vpcDetails.vpc;
    this.lambdaSecurityGroup = vpcDetails.securityGroups.privateEgress;

    const authParameters = importAuthParametersFromSsm();
    this.userPoolId = ssm.StringParameter.fromStringParameterName(
      this,
      "UserPoolId",
      authParameters.userPoolId,
    );
    this.clientId = ssm.StringParameter.fromStringParameterName(
      this,
      "ClientId",
      authParameters.clientId,
    );

    const elasticacheSecurityGroup = this.createElasticacheSecurityGroup();

    const cacheCluster = this.createElasticacheCluster([
      elasticacheSecurityGroup.securityGroupId,
    ]);

    this.redisEndpointParameter = new ssm.StringParameter(
      this,
      "ElasticacheClusterEndpoint",
      {
        parameterName: SsmKeys.redisEndpoint,
        stringValue: cacheCluster.attrConfigurationEndPointAddress,
      },
    );

    const authorizer = this.createAuthorizer();

    this.authorizer = authorizer;
    this.cacheCluster = cacheCluster;
  }

  private createElasticacheCluster(securityGroupIds: string[]) {
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "CacheSubnetGroup",
      {
        description: "Subnet group for ElastiCache Redis cluster",
        subnetIds: this.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }).subnetIds,
      },
    );

    const cluster = new elasticache.CfnReplicationGroup(this, "AuthCluster", {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheClusters: 3,
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      securityGroupIds,
      replicationGroupDescription: "Flex authentication cache",
      clusterMode: "enabled",
      multiAzEnabled: true,
      automaticFailoverEnabled: true,
      transitEncryptionEnabled: true,
      atRestEncryptionEnabled: true,
      // TODO: add auth token CKV_AWS_31
    });

    return cluster;
  }

  private createElasticacheSecurityGroup() {
    const securityGroup = new ec2.SecurityGroup(
      this,
      "ElasticacheSecurityGroup",
      {
        vpc: this.vpc,
        description: "SecurityGroup with allow inbound from Redis",
        allowAllOutbound: false,
        securityGroupName: "redis-access",
      },
    );

    securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.lambdaSecurityGroup.securityGroupId),
      ec2.Port.tcp(6379),
      "Allow inbound from Authorizer Lambda",
    );

    return securityGroup;
  }

  private createAuthorizer() {
    const authorizerFunction = new FlexPrivateEgressFunction(
      this,
      "AuthorizerFunction",
      {
        entry: getPlatformEntry("auth", "handler.ts"),
        environment: {
          REDIS_ENDPOINT_PARAMETER_NAME:
            this.redisEndpointParameter.parameterName,
          USER_POOL_ID_PARAMETER_NAME: this.userPoolId.parameterName,
          CLIENT_ID_PARAMETER_NAME: this.clientId.parameterName,
        },
      },
    );

    this.redisEndpointParameter.grantRead(authorizerFunction.function);
    this.userPoolId.grantRead(authorizerFunction.function);
    this.clientId.grantRead(authorizerFunction.function);

    return new HttpLambdaAuthorizer("Authorizer", authorizerFunction.function, {
      resultsCacheTtl: Duration.minutes(1), // see decision
    });
  }
}
