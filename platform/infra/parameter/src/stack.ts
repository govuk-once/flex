import { GovUkOnceStack } from "@platform/gov-uk-once";
import { Construct } from "constructs";

import { exportAuthParametersToSsm } from "./outputs";

export class FlexParameterStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    exportAuthParametersToSsm(this);
  }
}
