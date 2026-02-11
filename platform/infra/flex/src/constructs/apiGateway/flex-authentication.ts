import { importFlexParameter } from "@platform/core/outputs";
import { getEnvConfig } from "@platform/gov-uk-once";
import { Duration } from "aws-cdk-lib";
import { HttpLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import type { CfnUrl } from "aws-cdk-lib/aws-lambda";
import { FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

import { getPlatformEntry } from "../../utils/getEntry";
import { isJwksStubEnabled } from "../../utils/stubs";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: HttpLambdaAuthorizer;

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

    this.authorizer = new HttpLambdaAuthorizer(
      "Authorizer",
      authorizerFunction.function,
      {
        resultsCacheTtl: Duration.minutes(1), // see decision
      },
    );
  }

  private getAuthConfig() {
    const { stage } = getEnvConfig();
    const userPoolId = importFlexParameter(
      this,
      "/flex-param/auth/user-pool-id",
    );
    const clientId = importFlexParameter(this, "/flex-param/auth/client-id");
    let jwksUri = `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId.stringValue}/.well-known/jwks.json`;

    if (isJwksStubEnabled(stage)) {
      const jwksEndpointStubFunction = new NodejsFunction(
        this,
        "JwksEndpointStubFunction",
        {
          entry: getPlatformEntry("auth", "functions/jwks-endpoint.ts"),
          runtime: Runtime.NODEJS_24_X,
          handler: "handler",
        },
      );

      const jwksEndpointStubFunctionUrl =
        jwksEndpointStubFunction.addFunctionUrl({
          authType: FunctionUrlAuthType.NONE,
        });

      jwksUri = jwksEndpointStubFunctionUrl.url;

      (jwksEndpointStubFunctionUrl.node.defaultChild as CfnUrl).addMetadata(
        "checkov",
        {
          skip: [
            {
              id: "CKV_AWS_258",
              comment:
                "JWKS endpoint must be publicly accessible for JWT signature verification",
            },
          ],
        },
      );
    }

    return {
      clientId,
      jwksUri,
      userPoolId,
    };
  }
}
