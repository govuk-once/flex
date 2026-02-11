import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  HttpApi,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { FlexAuthentication } from "./flex-authentication";

export class FlexHttpApi extends Construct {
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const accessLogGroup = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_WEEK,
    });

    const authentication = new FlexAuthentication(this, "Authentication");

    this.httpApi = new HttpApi(this, "Api", {
      apiName: "Flex Platform API",
      description: "Central API Gateway for the Flex Platform",
      createDefaultStage: false,
      defaultAuthorizer: authentication.authorizer,
    });

    new HttpStage(this, "ApiStage", {
      httpApi: this.httpApi,
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
  }
}
