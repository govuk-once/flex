import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

import { FlexInternalGateway } from "../constructs/api-gateway/flex-internal-gateway";

export interface PrivateApiRef {
  restApiId: string;
  stageName: string;
  domainsRootResourceId: string;
  gatewaysRootResourceId: string;
}

export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly internalGateway: FlexInternalGateway;
  public readonly privateApiRef: PrivateApiRef;

  constructor(scope: Construct, id: string) {
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

    this.privateApiRef = {
      restApiId: internalGateway.privateGateway.restApiId,
      stageName: internalGateway.privateGateway.deploymentStage.stageName,
      domainsRootResourceId: internalGateway.domainsRoot.resourceId,
      gatewaysRootResourceId: internalGateway.gatewaysRoot.resourceId,
    };
  }
}
