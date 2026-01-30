import { importFlexParameter } from "@platform/core/outputs";
import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Construct } from "constructs";

import { getPlatformEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const clientId = importFlexParameter(this, "/flex-param/auth/client-id");
    const userPoolId = importFlexParameter(
      this,
      "/flex-param/auth/user-pool-id",
    );

    const authorizerFunction = new FlexPrivateEgressFunction(
      this,
      "AuthorizerFunction",
      {
        entry: getPlatformEntry("auth", "handler.ts"),
        environment: {
          USERPOOL_ID_PARAM_NAME: userPoolId.parameterName,
          CLIENT_ID_PARAM_NAME: clientId.parameterName,
        },
      },
    );

    userPoolId.grantRead(authorizerFunction.function);
    clientId.grantRead(authorizerFunction.function);

    this.authorizer = new HttpLambdaAuthorizer(
      "Authorizer",
      authorizerFunction.function,
      {
        resultsCacheTtl: Duration.minutes(1), // see decision
      },
    );
  }
}
