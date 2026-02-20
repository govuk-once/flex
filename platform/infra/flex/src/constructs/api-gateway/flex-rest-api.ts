import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  LogGroupLogDestination,
  ResponseType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { FlexAuthentication } from "./flex-authentication";

export class FlexRestApi extends Construct {
  public readonly restApi: RestApi;
  public readonly authorizerId: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const accessLogGroup = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_WEEK,
    });

    const authentication = new FlexAuthentication(this, "Authentication");
    this.authorizerId = authentication.authorizer.authorizerId;

    this.restApi = new RestApi(this, "Api", {
      description: "Central API Gateway for the Flex Platform",
      deployOptions: {
        tracingEnabled: true,
        metricsEnabled: true,
        stageName: "prod",
        accessLogDestination: new LogGroupLogDestination(accessLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
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
      defaultMethodOptions: {
        authorizer: authentication.authorizer,
        authorizationType: AuthorizationType.CUSTOM,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });
    applyCheckovSkip(
      this.restApi.deploymentStage,
      "CKV_AWS_120",
      "Disabled for now and will renable when caching strategy is defined",
    );
    this.addUnauthorizedResponseTemplate(this.restApi);
  }

  private addUnauthorizedResponseTemplate(restApi: RestApi) {
    restApi.addGatewayResponse("Unauthorized", {
      type: ResponseType.UNAUTHORIZED,
      statusCode: "401",
      templates: {
        "application/json":
          '{"message": "$context.authorizer.errorMessage", "type": "auth_error"}',
      },
    });

    restApi.addGatewayResponse("AccessDenied", {
      type: ResponseType.ACCESS_DENIED,
      statusCode: "403",
      templates: {
        "application/json":
          '{"message": "$context.authorizer.errorMessage", "type": "auth_error"}',
      },
    });
  }
}
