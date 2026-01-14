import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { getAwsAccount, GovUkOnceStack } from "./gov-uk-once-stack";
import { generateParamName } from "./gov-uk-once-stack";

export class FlexParameterStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: {
        region: "eu-west-2",
        account: getAwsAccount(), // TODO: should this be set as parameter in construct?
      },
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
    new ssm.StringParameter(this, "UserPoolId", {
      parameterName: generateParamName("/auth/user_pool_id"),
      stringValue: "placeholder",
    });

    new ssm.StringParameter(this, "ClientId", {
      parameterName: generateParamName("/auth/client_id"),
      stringValue: "placeholder",
    });
  }
}
