import { importFlexSecret } from "@platform/core/outputs";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { RouteGroup } from "./apiGateway/flex-route-group";
import { FlexPrivateIsolatedFunction } from "./lambda/flex-private-isolated-function";

export class UdpDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    const hashingSecret = importFlexSecret(
      this,
      "/flex-secret/udp/notification-hash-secret",
    );

    const postLoginFunction = new FlexPrivateIsolatedFunction(
      this,
      "PostLoginFunction",
      {
        entry: getEntry("udp", "handlers/post-login/post.ts"),
        domain: "udp",
        environment: {
          FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
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
