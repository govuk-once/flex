import {
  importFlexKmsKeyAlias,
  importFlexSecret,
} from "@platform/core/outputs";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";
import { RouteGroup } from "./flex-route-group";

export class UdpDomain extends Construct {
  constructor(scope: Construct, id: string, httpApi: HttpApi) {
    super(scope, id);

    const domain = "udp";
    const domainPath = "user";

    const v1RouteGroup = new RouteGroup(this, "V1RouteGroup", {
      httpApi: httpApi,
      version: "v1",
    });

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
        entry: getEntry(domain, "handlers/user/get.ts"),
        domain,
        environment: {
          FLEX_UDP_NOTIFICATION_SECRET: hashingSecret.secretName,
        },
      },
    );

    const patchFunction = new FlexPrivateIsolatedFunction(
      this,
      "PatchFunction",
      {
        entry: getEntry(domain, "handlers/user/patch.ts"),
        domain,
      },
    );

    hashingSecret.grantRead(getUserFunction.function);
    secretEncryptionKey.grantDecrypt(getUserFunction.function);

    v1RouteGroup.addRoute(
      domainPath,
      HttpMethod.GET,
      new HttpLambdaIntegration("GetUser", getUserFunction.function),
    );
    v1RouteGroup.addRoute(
      domainPath,
      HttpMethod.PATCH,
      new HttpLambdaIntegration("Patch", patchFunction.function),
    );
  }
}
