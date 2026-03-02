import { GovUkOnceStack } from "@platform/gov-uk-once";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import type { Construct } from "constructs";

import { FlexInternalGateway } from "../constructs/api-gateway/flex-internal-gateway";
import { addDeepResource } from "../utils/addDeepResource";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { PrivateRouteBinding } from "./private-domain";

interface FlexPrivateGatewayStackProps {
  privateRouteBindings: PrivateRouteBinding[];
}

export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly internalGateway: FlexInternalGateway;

  constructor(
    scope: Construct,
    id: string,
    { privateRouteBindings }: FlexPrivateGatewayStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-private-gateway",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const internalGateway = new FlexInternalGateway(this, "InternalGateway");
    this.internalGateway = internalGateway;

    // Register all private routes in this same stack so CDK's auto-deployment
    // hash includes them — this ensures the API Gateway stage is updated
    // whenever domain routes change.
    for (const route of privateRouteBindings) {
      const resource = addDeepResource(internalGateway.domainsRoot, route.path);
      const method = resource.addMethod(
        route.method,
        new LambdaIntegration(route.handler),
      );
      applyCheckovSkip(
        method,
        "CKV_AWS_59",
        "Private API - access restricted by VPC endpoint and resource policy",
      );
    }
  }
}
