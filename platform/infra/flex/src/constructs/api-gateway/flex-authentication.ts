import { importFlexParameter } from "@platform/core/outputs";
import { getEnvConfig } from "@platform/gov-uk-once";
import { Duration } from "aws-cdk-lib";
import {
  IAuthorizer,
  IdentitySource,
  TokenAuthorizer,
} from "aws-cdk-lib/aws-apigateway";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { getPlatformEntry } from "../../utils/getEntry";
import { isJwksStubEnabled } from "../../utils/stubs";
import { FlexPrivateEgressFunction } from "../lambda/flex-private-egress-function";

export class FlexAuthentication extends Construct {
  public readonly authorizer: IAuthorizer;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { clientId, jwksUri, userPoolId } = this.getAuthConfig();

    const authorizerFunction = new FlexPrivateEgressFunction(
      this,
      "AuthorizerFunction",
      {
        entry: getPlatformEntry("auth", "handler.ts"),
        // Timing out on the stub/dev env as takes longer than 3 seconds on cold starts
        timeout: Duration.seconds(10),
        environment: {
          USERPOOL_ID_PARAM_NAME: userPoolId.parameterName,
          CLIENT_ID_PARAM_NAME: clientId.parameterName,
          JWKS_URI: jwksUri,
        },
      },
    );

    userPoolId.grantRead(authorizerFunction.function);
    clientId.grantRead(authorizerFunction.function);

    this.authorizer = new TokenAuthorizer(this, "LambdaAuthorizer", {
      handler: authorizerFunction.function,
      identitySource: IdentitySource.header("Authorization"),
    });
  }

  private getAuthConfig() {
    const { stage } = getEnvConfig();

    let userPoolId = importFlexParameter(this, "/flex-param/auth/user-pool-id");
    let clientId = importFlexParameter(this, "/flex-param/auth/client-id");

    let jwksUri = `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId.stringValue}/.well-known/jwks.json`;

    /** Only runs this block of code if deploying into development env */
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

      const accountNumber = process.env.CDK_DEFAULT_ACCOUNT;
      if (accountNumber === undefined) {
        throw new Error("Account number undefined");
      }

      /**
       * Note:
       * - Keeping ARN hard coded as this is the only env this secret is kept in
       */
      jwksEndpointStubFunction.addToRolePolicy(
        new PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [
            `arn:aws:secretsmanager:eu-west-2:${accountNumber}:secret:/development/flex-secret/auth/e2e/private_jwk-*`,
          ],
        }),
      );

      const jwksEndpointStubFunctionUrl =
        jwksEndpointStubFunction.addFunctionUrl({
          authType: FunctionUrlAuthType.NONE,
        });
      jwksUri = jwksEndpointStubFunctionUrl.url;

      userPoolId = importFlexParameter(
        this,
        "/flex-param/auth/stub/user-pool-id",
      );
      clientId = importFlexParameter(this, "/flex-param/auth/stub/client-id");

      applyCheckovSkip(
        jwksEndpointStubFunctionUrl,
        "CKV_AWS_258",
        "JWKS endpoint must be publicly accessible for JWT signature verification",
      );
    }

    return {
      clientId,
      jwksUri,
      userPoolId,
    };
  }
}
