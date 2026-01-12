import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Code } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { FlexFunction } from "../constructs/flex-function";
import { GovUkOnceStack } from "./gov-uk-once-stack";

export class FlexPlatformStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: {
        region: "eu-west-2",
      },
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const accessLogGroup = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_WEEK,
    });

    const httpApi = new HttpApi(this, "Api", {
      apiName: "Flex Platform API",
      description: "Central API Gateway for the Flex Platform",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [CorsHttpMethod.ANY],
      },
      createDefaultStage: false,
    });

    new HttpStage(this, "ApiStage", {
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

    const helloFunction = new FlexFunction(this, "HelloFunction", {
      handler: {
        name: "index.handler",
        code: Code.fromInline(
          `exports.handler = (event) => ({ statusCode: 200, body: "Hello World" });`,
        ),
      },
    });

    httpApi.addRoutes({
      path: "/hello",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "HelloIntegration",
        helloFunction.handler,
      ),
    });
  }
}
