import { GovUkOnceStack } from "@platform/gov-uk-once";
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

import { getParamName } from "../utils/getParamName";

interface FlexPrivateGatewayDeploymentStackProps {
  /**
   * Hash of the currently-deployed private domain routes. When this changes
   * (routes added or removed), CloudFormation calls onUpdate which creates a
   * fresh API Gateway deployment capturing all current methods, then updates
   * the prod stage to point to it.
   */
  routesHash: string;
}

export class FlexPrivateGatewayDeploymentStack extends GovUkOnceStack {
  constructor(
    scope: Construct,
    id: string,
    { routesHash }: FlexPrivateGatewayDeploymentStackProps,
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

    const restApiId = StringParameter.fromStringParameterName(
      this,
      "PrivateGatewayRestApiId",
      getParamName("/flex-core/private-gateway/rest-api-id"),
    ).stringValue;

    const region = Stack.of(this).region;

    const policy = AwsCustomResourcePolicy.fromStatements([
      new PolicyStatement({
        actions: ["apigateway:POST", "apigateway:PATCH"],
        resources: [
          `arn:aws:apigateway:${region}::/restapis/*/deployments`,
          `arn:aws:apigateway:${region}::/restapis/*/stages/prod`,
        ],
      }),
    ]);

    // Create a new API Gateway deployment. The description encodes the routes
    // hash so CloudFormation triggers onUpdate (and creates a fresh deployment
    // snapshot) whenever domain routes change.
    const createDeployment = new AwsCustomResource(
      this,
      "CreateGatewayDeployment",
      {
        onUpdate: {
          service: "APIGateway",
          action: "createDeployment",
          parameters: {
            restApiId,
            description: `routes:${routesHash}`,
          },
          physicalResourceId: PhysicalResourceId.of(
            "flex-private-gateway-deployment",
          ),
        },
        policy,
      },
    );

    // Point the prod stage at the new deployment.
    const updateStage = new AwsCustomResource(this, "UpdateProdStage", {
      onUpdate: {
        service: "APIGateway",
        action: "updateStage",
        parameters: {
          restApiId,
          stageName: "prod",
          patchOperations: [
            {
              op: "replace",
              path: "/deploymentId",
              value: createDeployment.getResponseField("id"),
            },
          ],
        },
        physicalResourceId: PhysicalResourceId.of(
          "flex-private-gateway-stage-update",
        ),
      },
      policy,
    });

    updateStage.node.addDependency(createDeployment);
  }
}
