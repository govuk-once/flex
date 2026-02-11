import { IDomainConfig } from "@flex/sdk";
import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { EndpointType, IResource, RestApi } from "aws-cdk-lib/aws-apigateway";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

import { PrivateDomainFactory } from "./constructs/privateDomainFactory";
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

/**
 * Unified stack for the private API gateway, service gateways, and private
 * domain routes. Merged to avoid circular dependency between gateway (which
 * references Lambda integrations) and domain stacks (which need domainsResource).
 */
export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly privateGateway: RestApi;
  public readonly domainsResource: IResource;

  constructor(
    scope: Construct,
    id: string,
    props: {
      domains: IDomainConfig[];
      httpApi: HttpApi;
    },
  ) {
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

    // Step 2: Create service gateways
    createServiceGateways(this, gatewaysResource);

    // Step 3: Create private domain routes (same stack to avoid circular deps)
    for (const domainProps of props.domains) {
      if (domainProps.private) {
        const domainFactory = new PrivateDomainFactory(
          this,
          `${domainProps.domain}PrivateDomain`,
          domainProps.domain,
          props.httpApi,
          domainsResource,
        );
        domainFactory.processRoutes(domainProps.private);
      }
    }
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

    exportFlexPlatformParam(
      scope,
      "/flex-core/private-gateway/url",
      privateGateway.url.replace(/\/$/, ""), // remove trailing slash
    );

    return {
      privateGateway,
      domainsResource,
      gatewaysResource,
    };
  }
}
