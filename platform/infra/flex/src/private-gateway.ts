import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import {
  AccessLogFormat,
  EndpointType,
  IResource,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * Structure of the private API path tree. Created once and shared so that
 * service gateways and domain internal routes attach to the same tree.
 */
export interface PrivateGatewayStructure {
  privateGateway: RestApi;
  /** /gateways – attach service gateway routes here */
  gateways: IResource;
  /** /domains – attach domain internal routes here (e.g. via PrivateRouteGroup) */
  domains: IResource;
}

/**
 * Creates a private API Gateway that is only accessible from within the Flex VPC
 * and restricted to specific IAM principals (Flex lambdas).
 *
 * Also creates the canonical path tree so all consumers attach to the same resources:
 * - /gateways/* (service gateways)
 * - /domains/* (domain internal routes)
 *
 * Network isolation: Only accessible via VPC endpoint (no public internet access).
 * IAM isolation: Only designated Flex IAM roles can invoke the API.
 */
export function createPrivateGateway(
  scope: Construct,
): PrivateGatewayStructure {
  const accessLogGroup = new LogGroup(scope, "PrivateGatewayAccessLogGroup", {
    retention: RetentionDays.ONE_WEEK,
  });

  const privateGateway = new RestApi(scope, "PrivateGateway", {
    description:
      "Private API Gateway - Internal service-to-service and domain-to-gateway routing",
    policy: undefined,
    endpointConfiguration: {
      types: [EndpointType.PRIVATE],
    },
    deployOptions: {
      // send access logs here
      accessLogDestination: new LogGroupLogDestination(accessLogGroup),
      loggingLevel: MethodLoggingLevel.INFO,
      dataTraceEnabled: true,
      metricsEnabled: true,
      accessLogFormat: AccessLogFormat.custom(
        JSON.stringify({
          requestId: "$context.requestId",
          vpcEndpointId: "$context.identity.vpcEndpointId",
          userArn: "$context.identity.userArn",
          httpMethod: "$context.httpMethod",
          resourcePath: "$context.resourcePath",
          status: "$context.status",
          errorMessage: "$context.error.message",
          errorMessageString: "$context.error.messageString",
        }),
      ),
    },
  });

  const apiGatewayEndpoint = importInterfaceVpcEndpointFromSsm(
    scope,
    "/flex-core/vpc-endpoint/api-gateway",
  );

  privateGateway.grantInvokeFromVpcEndpointsOnly([apiGatewayEndpoint]);

  // Single place that owns the /internal tree so gateways and domains share it
  const domains = privateGateway.root.addResource("domains");
  const gateways = privateGateway.root.addResource("gateways");

  new StringParameter(scope, "PrivateGatewayUrl", {
    parameterName: "/flex-core/private-gateway/url",
    stringValue: privateGateway.url,
  });

  return {
    privateGateway,
    gateways,
    domains,
  };
}

export function importFlexPrivateGatewayParameter(scope: Construct) {
  return StringParameter.fromStringParameterName(
    scope,
    `FlexParamPrivateGatewayUrl`,
    "/flex-core/private-gateway/url",
  );
}
