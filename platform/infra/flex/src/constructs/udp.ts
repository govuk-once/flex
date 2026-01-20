import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateIsolatedFunction } from "./flex-private-isolated-function";

export class UdpDomain extends Construct {
  constructor(scope: Construct, id: string, httpApi: HttpApi) {
    super(scope, id);

    const postLoginFunction = new FlexPrivateIsolatedFunction(
      this,
      "PostLoginFunction",
      { entry: getEntry("udp", "handlers/post-login/post.ts") },
    );

    httpApi.addRoutes({
      path: "/post-login",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PostLogin",
        postLoginFunction.function,
      ),
    });
  }
}
