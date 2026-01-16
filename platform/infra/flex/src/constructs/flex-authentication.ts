import {
  importRedisEndpointFromSsm,
  importVpcDetailsFromSsm,
} from "@platform/core/outputs";
import { importAuthParametersFromSsm } from "@platform/parameter/outputs";
import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { getPlatformEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  private redisEndpointParameter: ssm.IStringParameter;
  private userPoolId: ssm.IStringParameter;
  private clientId: ssm.IStringParameter;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpcDetails = importVpcDetailsFromSsm(this);
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

    // Import Redis endpoint from core stack
    this.redisEndpointParameter = importRedisEndpointFromSsm(this);

    const authorizer = this.createAuthorizer();

    this.authorizer = authorizer;
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
