import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { STAGE_KEYS } from "../ssm-keys";

export class FlexApiDeploymentStack extends BaseStack {
  #deployApi(id: string, restApiId: string) {
    new AwsCustomResource(this, `${id}-DeployApi`, {
      onCreate: {
        service: "APIGateway",
        action: "createDeployment",
        parameters: {
          restApiId,
          stageName: "prod",
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
      onUpdate: {
        service: "APIGateway",
        action: "createDeployment",
        parameters: {
          restApiId,
          stageName: "prod",
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["apigateway:POST"],
          resources: [
            `arn:aws:apigateway:${this.region}::/restapis/${restApiId}/deployments`,
          ],
        }),
      ]),
    });
  }

  constructor(scope: Construct, id: string, deployedDomains: string[]) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
      dependencies: deployedDomains,
    });

    const publicRestApiId = this.import(STAGE_KEYS.ApigwPublicRestId);
    this.#deployApi("Public", publicRestApiId);

    const privateRestApiId = this.import(STAGE_KEYS.ApigwPrivateRestId);
    this.#deployApi("Private", privateRestApiId);
  }
}
