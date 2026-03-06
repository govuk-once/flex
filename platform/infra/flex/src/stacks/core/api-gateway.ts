import { CfnAccount } from "aws-cdk-lib/aws-apigateway";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export function addApiGatewayCloudWatchRole(scope: Construct) {
  const cloudWatchRole = new Role(scope, "ApiGatewayCloudWatchRole", {
    assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    managedPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonAPIGatewayPushToCloudWatchLogs", // pragma: allowlist secret
      ),
    ],
  });

  new CfnAccount(scope, "ApiGatewayAccount", {
    cloudWatchRoleArn: cloudWatchRole.roleArn,
  });
}
