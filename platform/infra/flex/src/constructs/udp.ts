import { getFlexSecretNamePrefix } from "@platform/parameter/outputs";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";

export class UdpDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    const hashingSecret = Secret.fromSecretNameV2(
      this,
      "UdpHashingSecret",
      getFlexSecretNamePrefix("/udp/notification-hash-secret"),
    );

    const postLoginFunction = new FlexPrivateIsolatedFunction(
      this,
      "PostLoginFunction",
      {
        entry: getEntry("udp", "handlers/post-login/post.ts"),
        domain: "udp",
        environment: {
          FLEX_UDP_NOTIFICATION_SECRET: getFlexSecretNamePrefix(
            "/udp/notification-hash-secret",
          ),
        },
      },
    );

    hashingSecret.grantRead(postLoginFunction.function);

    routeGroup.addRoute(
      "/user",
      HttpMethod.POST,
      new HttpLambdaIntegration("PostLogin", postLoginFunction.function),
    );
  }
}
