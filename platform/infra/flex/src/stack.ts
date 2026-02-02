import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { FlexAuthentication } from "./constructs/flex-authentication";
import { FlexFailFast } from "./constructs/flex-fail-fast";
import { FlexPrivateEgressFunction } from "./constructs/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { FlexPublicFunction } from "./constructs/flex-public-function";
import { RouteGroup } from "./constructs/flex-route-group";
import { UdpDomain } from "./constructs/udp";
import { getEntry } from "./utils/getEntry";

export class FlexPlatformStack extends GovUkOnceStack {
  private createHttpApi() {
    const accessLogGroup = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_WEEK,
    });

    const authentication = new FlexAuthentication(this, "Authentication");

    const httpApi = new HttpApi(this, "Api", {
      apiName: "Flex Platform API",
      description: "Central API Gateway for the Flex Platform",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [CorsHttpMethod.ANY],
      },
      createDefaultStage: false,
      defaultAuthorizer: authentication.authorizer,
    });

    const httpStage = new HttpStage(this, "ApiStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destination: new LogGroupLogDestination(accessLogGroup),
        format: AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
          caller: true,
        }),
      },
      detailedMetricsEnabled: true,
    });

    return {
      httpApiUrl: httpStage.url ?? "",
      httpApi,
    };
  }

  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const { httpApi, httpApiUrl } = this.createHttpApi();

    const helloPublicFunction = new FlexPublicFunction(
      this,
      "HelloPublicFunction",
      {
        entry: getEntry("hello", "handlers/hello-public/get.ts"),
        domain: "hello",
      },
    );

    httpApi.addRoutes({
      path: "/hello-public",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "HelloPublic",
        helloPublicFunction.function,
      ),
    });

    const helloPrivateFunction = new FlexPrivateEgressFunction(
      this,
      "HelloPrivateFunction",
      {
        entry: getEntry("hello", "handlers/hello-private/get.ts"),
        domain: "hello",
      },
    );

    httpApi.addRoutes({
      path: "/hello-private",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "HelloPrivate",
        helloPrivateFunction.function,
      ),
    });

    const helloIsolatedFunction = new FlexPrivateIsolatedFunction(
      this,
      "HelloIsolatedFunction",
      {
        entry: getEntry("hello", "handlers/hello-isolated/get.ts"),
        domain: "hello",
      },
    );

    httpApi.addRoutes({
      path: "/hello-isolated",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "HelloIsolated",
        helloIsolatedFunction.function,
      ),
    });

    const v1 = new RouteGroup(this, "V1", {
      httpApi,
      pathPrefix: "/v1/app",
    });

    new UdpDomain(this, "UdpDomain", v1);

    const failFast = new FlexFailFast(this, "FailFast", httpApi);

    new CfnOutput(this, "HttpApiUrl", { value: httpApiUrl });
    new CfnOutput(this, "CloudfrontDistributionUrl", {
      value: `https://${failFast.distribution.distribution.distributionDomainName}`,
    });
  }
}
