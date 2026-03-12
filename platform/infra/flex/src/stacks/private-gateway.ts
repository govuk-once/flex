import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

import { FlexInternalGateway } from "../constructs/api-gateway/flex-internal-gateway";

export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly internalGateway: FlexInternalGateway;

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

    this.internalGateway = new FlexInternalGateway(this, "InternalGateway");
  }
}
