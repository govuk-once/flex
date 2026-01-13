import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import { Code, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { generateParamName } from "../stacks/gov-uk-once-stack";
import { FlexFunction } from "./flex-function";

interface FlexAuthenticationProps {
  readonly vpc: ec2.IVpc;
}

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

  public readonly cacheCluster: elasticache.CfnReplicationGroup;

  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: FlexAuthenticationProps) {
    super(scope, id);

    const { vpc } = props;

    const lambdaAuthorizerSecurityGroup =
      this.createLambdaAuthorizerSecurityGroup(vpc);

    const elasticacheSecurityGroup = this.createElasticacheSecurityGroup(
      vpc,
      ssm.StringParameter.valueFromLookup(this, "/network/sg/private-egress"),
    );

    const cacheCluster = this.createElasticacheCluster(
      ssm.StringParameter.valueFromLookup(
        this,
        "/network/subnets/private-egress",
      ),
      elasticacheSecurityGroup,
    );

    const authorizer = this.createAuthorizer();

    this.authorizer = authorizer;
    this.cacheCluster = cacheCluster;
    this.lambdaSecurityGroup = lambdaAuthorizerSecurityGroup;
  }

  private createLambdaAuthorizerSecurityGroup(vpc: ec2.IVpc) {
    return new ec2.SecurityGroup(this, "LambdaAuthorizerSecurityGroup", {
      vpc,
      description: "SecurityGroup with allow outbound",
      allowAllOutbound: true,
    });
  }

  private createElasticacheCluster(
    privateEgressSubnetGroupName: string,
    securityGroup: ec2.SecurityGroup,
  ) {
    const cluster = new elasticache.CfnReplicationGroup(this, "AuthCluster", {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheClusters: 3,
      cacheSubnetGroupName: privateEgressSubnetGroupName,
      securityGroupIds: [securityGroup.securityGroupId],
      replicationGroupDescription: "JWKS cache for national scale",
      clusterMode: "enabled",
      multiAzEnabled: true,
      automaticFailoverEnabled: true,
    });

    new ssm.StringParameter(this, "ElasticacheClusterEndpoint", {
      parameterName: generateParamName("/cache/redis/endpoint"),
      stringValue: cluster.attrPrimaryEndPointAddress,
    });

    return cluster;
  }

  private createElasticacheSecurityGroup(
    vpc: ec2.IVpc,
    authorizerSecurityGroupId: string,
  ) {
    const securityGroup = new ec2.SecurityGroup(
      this,
      "ElasticacheSecurityGroup",
      {
        vpc,
        description: "SecurityGroup with allow inbound from Redis",
        allowAllOutbound: false,
        securityGroupName: "sg-redis-access",
      },
    );

    securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(authorizerSecurityGroupId),
      ec2.Port.tcp(6379),
      "Allow inbound from Authorizer Lambda",
    );

    return securityGroup;
  }

  private createAuthorizer() {
    const authorizerFunction = new FlexFunction(this, "AuthorizerFunction", {
      handler: {
        name: "index.handler",
        code: Code.fromInline(
          `exports.handler = (event) => {
            const { authorizationToken } = event;
            if (!authorizationToken) {
              return {
                statusCode: 401,
                body: "Unauthorized",
              };
            }
          }`,
        ),
        environment: {
          CLIENT_ID: ssm.StringParameter.valueFromLookup(
            this,
            "/flex/cognito/clientId",
          ),
          USER_POOL_ID: ssm.StringParameter.valueFromLookup(
            this,
            "/flex/cognito/userPoolId",
          ),
        },
        runtime: Runtime.NODEJS_24_X,
        timeout: Duration.seconds(5),
        tracing: Tracing.ACTIVE,
      },
    });

    return new HttpLambdaAuthorizer("Authorizer", authorizerFunction.handler);
  }
}
