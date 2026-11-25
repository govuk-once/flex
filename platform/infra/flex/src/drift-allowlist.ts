import type { DriftAllowlistEntry } from "./utils/drift";

/**
 * Drift that is expected by design and must not block a deploy.
 *
 * Every entry is scoped to one stack, logical ID and property path. Keep the
 * list short: anything not listed here fails the pre-deploy drift check.
 *
 * The stage DeploymentId entries exist because the prod stages have two
 * owners: FlexPlatform creates them through CloudFormation, and
 * FlexApiDeployment moves them with apigateway:CreateDeployment after the
 * domain stacks add their routes. Removing them needs the stages moved into
 * FlexApiDeployment, which is not planned ahead of the platform migration.
 *
 * Entries with expectedRewrites are narrower: the difference is only allowed
 * when applying the rewrites to the expected value gives exactly the actual
 * value, so any other change to the property still fails the check.
 */
export const driftAllowlist: DriftAllowlistEntry[] = [
  {
    stack: "FlexPlatform",
    logicalId: "ApiDeploymentStageprod3EB9684E",
    propertyPath: "/DeploymentId",
    reason:
      "FlexApiDeployment calls apigateway:CreateDeployment directly, moving the stage to a deployment CloudFormation does not track",
  },
  {
    stack: "FlexPlatform",
    logicalId: "PrivateGatewayDeploymentStageprodC0187B9E",
    propertyPath: "/DeploymentId",
    reason:
      "FlexApiDeployment calls apigateway:CreateDeployment directly, moving the stage to a deployment CloudFormation does not track",
  },
  {
    stack: "FlexPlatform",
    logicalId: "PrivateGateway81215152",
    propertyPath: "/Policy",
    expectedRewrites: [
      // Shorthand written by templates deployed before #654
      {
        from: '"execute-api:/',
        to: '"arn:aws:execute-api:{region}:{account}:{physicalId}/',
      },
      // Full ARN with a wildcard API ID, written since #654
      {
        from: '"arn:aws:execute-api:{region}:{account}:*/',
        to: '"arn:aws:execute-api:{region}:{account}:{physicalId}/',
      },
    ],
    reason:
      "API Gateway stores the policy Resource with the API's own ID filled in. The template cannot use that ID because a RestApi cannot reference itself",
  },
];
