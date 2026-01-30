import {
  importFlexKmsKeyAlias,
  importFlexSecret,
} from "@platform/core/outputs";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";

export class UdpDomain extends Construct {
  constructor(scope: Construct, id: string, routeGroup: RouteGroup) {
    super(scope, id);

    const hashingSecret = importFlexSecret(
      this,
      "/flex-secret/udp/notification-hash-secret",
    );

    const secretEncryptionKey = importFlexKmsKeyAlias(
      this,
      "/flex-secret/encryption-key",
    );

    const getUserFunction = new FlexPrivateIsolatedFunction(
      this,
      "GetUserFunction",
      {
        entry: getEntry("udp", "handlers/user/get.ts"),
        domain: "udp",
        environment: {
          FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
        },
      },
    );

    const patchFunction = new FlexPrivateIsolatedFunction(
      this,
      "PatchFunction",
      {
        entry: getEntry("udp", "handlers/user/patch.ts"),
        domain: "udp",
      },
    );

    hashingSecret.grantRead(getUserFunction.function);
    secretEncryptionKey.grantDecrypt(getUserFunction.function);

    routeGroup.addRoute(
      "/user",
      HttpMethod.GET,
      new HttpLambdaIntegration("GetUser", getUserFunction.function),
    );
    routeGroup.addRoute(
      "/user",
      HttpMethod.PATCH,
      new HttpLambdaIntegration("Patch", patchFunction.function),
    );
  }
}
