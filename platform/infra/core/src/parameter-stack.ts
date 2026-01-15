import { GovUkOnceStack } from "@platform/gov-uk-once";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { generateParamName } from "./outputs";

export class FlexParameterStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    this.createAuthorizerParameters();
  }

  private createAuthorizerParameters() {
    const AuthKeys = {
      userPoolId: generateParamName("/auth/user_pool_id"),
      clientId: generateParamName("/auth/client_id"),
    } as const;

    new ssm.StringParameter(this, "UserPoolId", {
      parameterName: AuthKeys.userPoolId,
      stringValue: "placeholder",
    });

    new ssm.StringParameter(this, "ClientId", {
      parameterName: AuthKeys.clientId,
      stringValue: "placeholder",
    });
  }
}
