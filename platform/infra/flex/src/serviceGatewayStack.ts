import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { EndpointType, IResource, RestApi } from "aws-cdk-lib/aws-apigateway";
import type { Construct } from "constructs";

import { exportFlexPlatformParam } from "./outputs";
import { createServiceGateways } from "./service-gateway/service-gateway";

/**
 * Structure of the private API path tree. Created once and shared so that
 * service gateways and domain internal routes attach to the same tree.
 */
export interface PrivateGatewayStructure {
  privateGateway: RestApi;
  domainsResource: IResource;
  gatewaysResource: IResource;
}
export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly privateGateway: RestApi;
  public readonly domainsResource: IResource;

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

    // Step 1: Create the private gateway
    const { privateGateway, domainsResource, gatewaysResource } =
      this.createPrivateGateway(this);
    this.privateGateway = privateGateway;
    this.domainsResource = domainsResource;

    // Step 3: Create service gateways
    createServiceGateways(this, gatewaysResource);
  }

  createPrivateGateway(scope: Construct): PrivateGatewayStructure {
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

    const domainsResource = privateGateway.root.addResource("domains");
    const gatewaysResource = privateGateway.root.addResource("gateways");

    exportFlexPlatformParam(scope, "/flex-core/private-gateway/url", privateGateway.url);

    return {
      privateGateway,
      domainsResource,
      gatewaysResource,
    };
  }
}
