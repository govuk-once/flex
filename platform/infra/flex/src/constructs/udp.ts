import {
  importFlexKmsKeyAlias,
  importFlexSecret,
} from "@platform/core/outputs";
import { IResource, RestApi } from "aws-cdk-lib/aws-apigateway";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { grantPrivateApiAccess } from "../private-gateway-permissions";
import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";
import { PrivateRouteGroup } from "./private-route-group";

export interface UdpDomainOptions {
  /** When set, enables POST /user which calls the private API (UDP connector). */
  privateGateway: RestApi;
  /** Pre-created /internal/gateways resource from createPrivateGateway() */
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
    const domainPath = "user";

    const hashingSecret = importFlexSecret(
      this,
      "/flex-secret/udp/notification-hash-secret",
    );

    const secretEncryptionKey = importFlexKmsKeyAlias(
      this,
      "/flex-secret/encryption-key",
    );

    // ---- Ingress Layer ---- //

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
          FLEX_PRIVATE_API_URL: options.privateGateway.url,
          FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
        },
      },
    );
    hashingSecret.grantRead(getUserInfoFunction.function);
    secretEncryptionKey.grantDecrypt(getUserInfoFunction.function);

    v1RouteGroup.addRoute(
      domainPath,
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
          FLEX_PRIVATE_API_URL: options.privateGateway.url,
        },
      },
    );

    const postFunction = new FlexPrivateIsolatedFunction(this, "PostFunction", {
      entry: getEntry(domain, "handlers/user/post.ts"),
      domain,
      environment: {
        FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
        FLEX_PRIVATE_API_URL: options.privateGateway.url,
      },
      // bundling: {
      //   nodeModules: ["aws-sigv4-fetch", "@smithy/util-utf8"],
      // },
    });

    hashingSecret.grantRead(postFunction.function);
    secretEncryptionKey.grantDecrypt(postFunction.function);

    grantPrivateApiAccess(postFunction.function.role, options.privateGateway, {
      domainId: domain,
      allowedRoutePrefixes: ["/internal/gateways/udp"],
    });
    grantPrivateApiAccess(patchFunction.function.role, options.privateGateway, {
      domainId: domain,
      allowedRoutePrefixes: ["/internal/gateways/udp"],
    });
    grantPrivateApiAccess(
      getUserInfoFunction.function.role,
      options.privateGateway,
      {
        domainId: domain,
        allowedRoutePrefixes: ["/internal/udp/user", "/internal/gateways/udp"],
        allowedMethods: ["GET", "POST"],
      },
    );
    options.privateRoutes.addRoute(
      "domain",
      domain,
      "POST",
      postFunction.function,
    );
    options.privateRoutes.addRoute(
      "domain",
      domain,
      "PATCH",
      patchFunction.function,
    );
  }
}
