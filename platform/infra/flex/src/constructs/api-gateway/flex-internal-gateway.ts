import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
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
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { applyCheckovSkip } from "../../utils/applyCheckovSkip";
import { getParamName } from "../../utils/getParamName";
import { createUdpServiceGateway } from "../gateways/udp";

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
export class FlexInternalGateway extends Construct {
  public readonly privateGateway: RestApi;
  public readonly domainsRoot: IResource;
  public readonly gatewaysRoot: IResource;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { privateGateway, domainsRoot, gatewaysRoot } =
      this.createInternalGateway(this);
    this.privateGateway = privateGateway;
    this.domainsRoot = domainsRoot;
    this.gatewaysRoot = gatewaysRoot;

    createUdpServiceGateway(this, gatewaysRoot);
  }

  createInternalGateway(scope: Construct) {
    const apiGatewayEndpoint = importInterfaceVpcEndpointFromSsm(
      scope,
      "/flex-core/vpc-endpoint/api-gateway",
    );

    const accessLogGroup = new LogGroup(scope, "AccessLogGroup", {
      retention: RetentionDays.ONE_YEAR,
    });

    const privateGateway = new RestApi(scope, "PrivateGateway", {
      description:
        "Private API Gateway - Internal service-to-service and domain-to-gateway routing",
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
          new PolicyStatement({
            effect: Effect.DENY,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              StringNotEquals: {
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

    // private gateway looks empty when deployed, so add a health check
    privateGateway.root
      .addResource("health")
      .addMethod("GET", new MockIntegration());

    applyCheckovSkip(
      privateGateway.deploymentStage,
      "CKV_AWS_120",
      "Disabled for now and will renable when caching strategy is defined",
    );

    const domainsRoot = privateGateway.root.addResource("domains");
    const gatewaysRoot = privateGateway.root.addResource("gateways");

    const privateGatewayUrl = privateGateway.url.replace(/\/$/, ""); // remove trailing slash

    new CfnOutput(scope, "PrivateGatewayUrl", {
      key: "PrivateGatewayUrl",
      value: privateGatewayUrl,
      description: "Private API Gateway URL (only reachable from within VPC)",
    });

    new StringParameter(scope, "PrivateGatewayUrlParam", {
      parameterName: getParamName("/flex-core/private-gateway/url"),
      stringValue: privateGatewayUrl,
    });

    return {
      privateGateway,
      domainsRoot,
      gatewaysRoot,
    };
  }
}
