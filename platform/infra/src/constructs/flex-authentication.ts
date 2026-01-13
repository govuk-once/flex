import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { generateParamName } from "../stacks/gov-uk-once-stack";
import { FlexPrivateEgressFunction } from "./flex-private-egress-function";

interface FlexAuthenticationProps {
  readonly vpc: ec2.IVpc;
}

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

  public readonly cacheCluster: elasticache.CfnReplicationGroup;

  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  private redisEndpointParameter: ssm.StringParameter;

  private readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: FlexAuthenticationProps) {
    super(scope, id);

    const { vpc } = props;
    this.vpc = vpc;

    const lambdaAuthorizerSecurityGroup =
      this.createLambdaAuthorizerSecurityGroup(vpc);
    this.lambdaSecurityGroup = lambdaAuthorizerSecurityGroup;

    const elasticacheSecurityGroup = this.createElasticacheSecurityGroup(
      vpc,
      lambdaAuthorizerSecurityGroup,
    );

    const cacheCluster = this.createElasticacheCluster([
      elasticacheSecurityGroup.securityGroupId,
    ]);

    this.redisEndpointParameter = new ssm.StringParameter(
      this,
      "ElasticacheClusterEndpoint",
      {
        parameterName: generateParamName("/cache/redis/endpoint"),
        stringValue: cacheCluster.attrConfigurationEndPointAddress,
      },
    );

    const authorizer = this.createAuthorizer();

    this.authorizer = authorizer;
    this.cacheCluster = cacheCluster;
  }

  private createLambdaAuthorizerSecurityGroup(vpc: ec2.IVpc) {
    return new ec2.SecurityGroup(this, "LambdaAuthorizerSecurityGroup", {
      vpc,
      description: "SecurityGroup with allow outbound",
      allowAllOutbound: true,
    });
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
    });

    return cluster;
  }

  private createElasticacheSecurityGroup(
    vpc: ec2.IVpc,
    authorizerSecurityGroup: ec2.SecurityGroup,
  ) {
    const securityGroup = new ec2.SecurityGroup(
      this,
      "ElasticacheSecurityGroup",
      {
        vpc,
        description: "SecurityGroup with allow inbound from Redis",
        allowAllOutbound: false,
        securityGroupName: "redis-access",
      },
    );

    securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(authorizerSecurityGroup.securityGroupId),
      ec2.Port.tcp(6379),
      "Allow inbound from Authorizer Lambda",
    );

    return securityGroup;
  }

  private createAuthorizer() {
    // Create subnet selection for private egress subnets
    const vpcSubnets: ec2.SubnetSelection = {
      subnets: this.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnets,
    };

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const authorizerFunction = new FlexPrivateEgressFunction(
      this,
      "AuthorizerFunction",
      {
        entry: join(__dirname, "../../../domains/auth/src/handler.ts"),
        environment: {
          //   TODO: add cognito client id and user pool id
          REDIS_ENDPOINT_PARAMETER_NAME: generateParamName(
            "/cache/redis/endpoint",
          ),
        },
        vpc: this.vpc,
        vpcSubnets,
        securityGroups: [this.lambdaSecurityGroup],
      },
    );

    this.redisEndpointParameter.grantRead(authorizerFunction.function);

    return new HttpLambdaAuthorizer("Authorizer", authorizerFunction.function, {
      resultsCacheTtl: Duration.minutes(1), // see decision decision
    });
  }
}
