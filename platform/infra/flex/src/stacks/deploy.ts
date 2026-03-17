import crypto from "node:crypto";

import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { STAGE_KEYS } from "../ssm-keys";

interface RouteBinding {
  readonly method: string;
  readonly path: string;
}

interface FlexApiDeploymentStackProps {
  deployedDomains: string[];
  publicRouteBindings: RouteBinding[];
  privateRouteBindings: RouteBinding[];
}

function buildRoutesHash(bindings: RouteBinding[]) {
  return crypto
    .createHash("sha256")
    .update(
      bindings
        .map((b) => `${b.method}:${b.path}`)
        .sort()
        .join("|"),
    )
    .digest("hex");
}

export class FlexApiDeploymentStack extends BaseStack {
  #deployApi(id: string, restApiId: string, routesHash: string) {
    const deployAction = {
      service: "APIGateway",
      action: "createDeployment",
      parameters: {
        restApiId,
        stageName: "prod",
        description: `routes:${routesHash}`,
      },
      physicalResourceId: PhysicalResourceId.of(
        `flex-${id.toLowerCase()}-gateway-deployment`,
      ),
    };

    new AwsCustomResource(this, `${id}-DeployApi`, {
      onCreate: deployAction,
      onUpdate: deployAction,
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

  constructor(
    scope: Construct,
    id: string,
    {
      deployedDomains,
      publicRouteBindings,
      privateRouteBindings,
    }: FlexApiDeploymentStackProps,
  ) {
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
    this.#deployApi(
      "Public",
      publicRestApiId,
      buildRoutesHash(publicRouteBindings),
    );

    const privateRestApiId = this.import(STAGE_KEYS.ApigwPrivateRestId);
    this.#deployApi(
      "Private",
      privateRestApiId,
      buildRoutesHash(privateRouteBindings),
    );
  }
}
