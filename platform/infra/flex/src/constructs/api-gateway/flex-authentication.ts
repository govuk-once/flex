import { importFlexParameter } from "@platform/core/outputs";
import {
  IAuthorizer,
  IdentitySource,
  TokenAuthorizer,
} from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: IAuthorizer;
  public readonly authorizerLambdaArn: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { clientId, jwksUri, userPoolId } = this.getAuthConfig();

    const authorizerFunction = new FlexPrivateEgressFunction(
      this,
      "AuthorizerFunction",
      {
        entry: getPlatformEntry("auth", "handler.ts"),
        environment: {
          USERPOOL_ID_PARAM_NAME: userPoolId.parameterName,
          CLIENT_ID_PARAM_NAME: clientId.parameterName,
          JWKS_URI: jwksUri,
        },
      },
    );

    userPoolId.grantRead(authorizerFunction.function);
    clientId.grantRead(authorizerFunction.function);

    this.authorizerLambdaArn = authorizerFunction.function.functionArn;

    this.authorizer = new TokenAuthorizer(this, "LambdaAuthorizer", {
      handler: authorizerFunction.function,
      identitySource: IdentitySource.header("Authorization"),
    });
  }

  private getAuthConfig() {
    const clientId = importFlexParameter(this, "/flex-param/auth/client-id");
    const userPoolId = importFlexParameter(
      this,
      "/flex-param/auth/user-pool-id",
    );
    const jwksUri = `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId.stringValue}/.well-known/jwks.json`;

    return {
      clientId,
      userPoolId,
      jwksUri,
    };
  }
}
