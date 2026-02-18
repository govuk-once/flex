import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  IResource,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MockIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { applyCheckovSkip } from "../utils/applyCheckovSkip";

/**
 * Structure of the private API path tree. Created once and shared so that
 * service gateways and domain internal routes attach to the same tree.
 */
export interface PrivateGatewayStructure {
  privateGateway: RestApi;
  domainsResource: IResource;
  gatewaysResource: IResource;
}

/**
 * Unified stack for the private API gateway, service gateways, and private
 * domain routes. Merged to avoid circular dependency between gateway (which
 * references Lambda integrations) and domain stacks (which need domainsResource).
 */
export class FlexInternalGatewayStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    this.createInternalGateway(this);
  }

  createInternalGateway(scope: Construct) {
    const apiGatewayEndpoint = importInterfaceVpcEndpointFromSsm(
      scope,
      "/flex-core/vpc-endpoint/api-gateway",
    );

    const accessLogGroup = new LogGroup(scope, "AccessLogGroup", {
      retention: RetentionDays.ONE_MONTH,
    });

    const privateGateway = new RestApi(scope, "PrivateGateway", {
      description: `Private API Gateway - Internal service-to-service and domain-to-gateway routing for stack ${this.stackName}`,
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              StringEquals: {
                "aws:SourceVpce": apiGatewayEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
      disableExecuteApiEndpoint: false,
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
        vpcEndpoints: [apiGatewayEndpoint],
      },
    });
    applyCheckovSkip(
      privateGateway.deploymentStage,
      "CKV_AWS_120",
      "Disabled for now and will renable when caching strategy is defined",
    );

    privateGateway.grantInvokeFromVpcEndpointsOnly([apiGatewayEndpoint]);

    privateGateway.root.addResource("hello").addMethod(
      HttpMethod.GET,
      new MockIntegration({
        requestTemplates: {
          "application/json": '{"statusCode": 200}',
        },
      }),
    );

    const privateGatewayUrl = privateGateway.url.replace(/\/$/, ""); // remove trailing slash

    new CfnOutput(scope, "PrivateGatewayUrl", {
      value: privateGatewayUrl,
      description: "Private API Gateway URL (only reachable from within VPC)",
    });

    return {
      privateGateway,
    };
  }
}
