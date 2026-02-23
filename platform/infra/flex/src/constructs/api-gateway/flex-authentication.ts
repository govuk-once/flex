import { importFlexParameter } from "@platform/core/outputs";
import { Construct } from "constructs";

import { getPlatformEntry } from "../../utils/getEntry";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

/**
 * Creates the authorizer Lambda function.
 * The actual TokenAuthorizer is created per domain stack to avoid CDK validation issues.
 */
export class FlexAuthentication extends Construct {
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
