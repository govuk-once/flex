import {
  importFlexKmsKeyAlias,
  importFlexSecret,
} from "@platform/core/outputs";
import { Duration } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { importFlexPrivateGatewayParameter } from "../private-gateway";
import { grantPrivateApiAccess } from "../private-gateway-permissions";
import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";
import { PrivateRouteGroup } from "./private-route-group";

export interface UdpDomainOptions {
  /** When set, enables POST /user which calls the private API (UDP connector). */
  privateGateway: RestApi;
  /** Pre-created /gateways resource from createPrivateGateway() */
  privateRoutes: PrivateRouteGroup;
}

export class UdpDomain extends Construct {
  constructor(
    scope: Construct,
    id: string,
    httpApi: HttpApi,
    options: UdpDomainOptions,
  ) {
    super(scope, id);

    const domain = "udp";
    const resourcePath = "user";

    const hashingSecret = importFlexSecret(
      this,
      "/flex-secret/udp/notification-hash-secret",
    );

    const secretEncryptionKey = importFlexKmsKeyAlias(
      this,
      "/flex-secret/encryption-key",
    );

    // ---- Ingress Layer ---- //
    const privateGatewayUrl = importFlexPrivateGatewayParameter(this);

    const v1RouteGroup = new RouteGroup(this, "V1RouteGroup", {
      httpApi: httpApi,
      version: "v1",
    });

    const getUserInfoFunction = new FlexPrivateIsolatedFunction(
      this,
      "GetUserInfoFunction",
      {
        entry: getEntry(domain, "handlers/user/getUserInfo.ts"),
        domain,
        environment: {
          FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: privateGatewayUrl.parameterName,
          FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
        },
        timeout: Duration.seconds(30),
      },
    );
    hashingSecret.grantRead(getUserInfoFunction.function);
    secretEncryptionKey.grantDecrypt(getUserInfoFunction.function);
    privateGatewayUrl.grantRead(getUserInfoFunction.function);

    v1RouteGroup.addRoute(
      resourcePath,
      HttpMethod.GET,
      new HttpLambdaIntegration("GetUserInfo", getUserInfoFunction.function),
    );

    // ---- Service Layer ---- //
    const patchFunction = new FlexPrivateIsolatedFunction(
      this,
      "PatchFunction",
      {
        entry: getEntry(domain, "handlers/user/patch.ts"),
        domain,
        environment: {
          FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: privateGatewayUrl.parameterName,
        },
        timeout: Duration.seconds(30),
      },
    );
    privateGatewayUrl.grantRead(patchFunction.function);
    const postFunction = new FlexPrivateIsolatedFunction(this, "PostFunction", {
      entry: getEntry(domain, "handlers/user/post.ts"),
      domain,
      environment: {
        FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: privateGatewayUrl.parameterName,
      },
      timeout: Duration.seconds(30),
    });

    privateGatewayUrl.grantRead(postFunction.function);

    grantPrivateApiAccess(postFunction.function.role, options.privateGateway, {
      domainId: domain,
      allowedRoutePrefixes: [options.privateRoutes.gatewayPathPrefix],
    });

    grantPrivateApiAccess(patchFunction.function.role, options.privateGateway, {
      domainId: domain,
      allowedRoutePrefixes: [options.privateRoutes.gatewayPathPrefix],
    });

    grantPrivateApiAccess(
      getUserInfoFunction.function.role,
      options.privateGateway,
      {
        domainId: domain,
        allowedRoutePrefixes: [
          `${options.privateRoutes.domainPathPrefix}/${resourcePath}`,
          options.privateRoutes.gatewayPathPrefix,
        ],
        allowedMethods: ["*"],
      },
    );

    options.privateRoutes.addRoute(
      "domain",
      `${domain}/${resourcePath}`,
      "POST",
      postFunction.function,
    );
    options.privateRoutes.addRoute(
      "domain",
      `${domain}/${resourcePath}`,
      "PATCH",
      patchFunction.function,
    );
  }
}
