import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import { EndpointType, IResource, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

/**
 * Structure of the private API path tree. Created once and shared so that
 * service gateways and domain internal routes attach to the same /internal tree.
 */
export interface PrivateGatewayStructure {
  privateGateway: RestApi;
  /** /internal/gateways – attach service gateway routes here */
  gateways: IResource;
  /** /internal/domains – attach domain internal routes here (e.g. via PrivateRouteGroup) */
  domains: IResource;
}

/**
 * Creates a private API Gateway that is only accessible from within the Flex VPC
 * and restricted to specific IAM principals (Flex lambdas).
 *
 * Also creates the canonical path tree so all consumers attach to the same resources:
 * - /internal/gateways/* (service gateways)
 * - /internal/domains/* (domain internal routes)
 *
 * Network isolation: Only accessible via VPC endpoint (no public internet access).
 * IAM isolation: Only designated Flex IAM roles can invoke the API.
 */
export function createPrivateGateway(
  scope: Construct,
): PrivateGatewayStructure {
  const privateGateway = new RestApi(scope, "PrivateGateway", {
    description:
      "Private API Gateway - Internal service-to-service and domain-to-gateway routing",
    policy: undefined,
    endpointConfiguration: {
      types: [EndpointType.PRIVATE],
    },
  });

  const apiGatewayEndpoint = importInterfaceVpcEndpointFromSsm(
    scope,
    "/flex-core/vpc-endpoint/api-gateway",
  );

  privateGateway.grantInvokeFromVpcEndpointsOnly([apiGatewayEndpoint]);

  // Single place that owns the /internal tree so gateways and domains share it
  const internal = privateGateway.root.addResource("internal");
  const domains = internal.addResource("domains");
  const gateways = internal.addResource("gateways");

  return {
    privateGateway,
    gateways,
    domains,
  };
}
