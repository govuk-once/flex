import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Code } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { FlexAuthentication } from "../constructs/flex-authentication";
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

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: ssm.StringParameter.valueFromLookup(this, "/vpc/id"),
    });

    const authentication = new FlexAuthentication(this, "Authentication", {
      vpc,
    });

    const httpApi = new HttpApi(this, "Api", {
      apiName: `${this.stackName}-api`,
      description: `Central API Gateway for the Flex Platform.`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [CorsHttpMethod.ANY],
      },
      createDefaultStage: false,
      defaultAuthorizer: authentication.authorizer,
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
