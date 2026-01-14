import { getEnvConfig } from "@platform/gov-uk-once";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const envConfig = getEnvConfig();

export function generateParamName(name: string) {
  // /development/flex-core/vpc/id
  return `/${envConfig.environment}/flex-core${name}`;
}

const SsmKeys = {
  vpcId: generateParamName("/vpc/id"),
  securityGroups: {
    privateEgressId: generateParamName(
      "/network/security-group/private-egress",
    ),
    privateIsolated: generateParamName(
      "/network/security-group/private-isolated",
    ),
  },
} as const;

export function exportVpcDetailsToSsm(
  scope: Construct,
  {
    vpcId,
    securityGroups,
  }: {
    vpcId: string;
    securityGroups: {
      privateEgressId: string;
      privateIsolatedId: string;
    };
  },
) {
  new StringParameter(scope, "VpcId", {
    parameterName: SsmKeys.vpcId,
    stringValue: vpcId,
  });

  new StringParameter(scope, "PrivateEgressSecurityGroup", {
    parameterName: SsmKeys.securityGroups.privateEgressId,
    stringValue: securityGroups.privateEgressId,
  });

  new StringParameter(scope, `PrivateIsolatedSecurityGroup`, {
    parameterName: SsmKeys.securityGroups.privateIsolated,
    stringValue: securityGroups.privateIsolatedId,
  });
}

export function importVpcDetailsFromSsm(scope: Construct) {
  const vpcId = StringParameter.valueFromLookup(scope, SsmKeys.vpcId);
  const securityGroups = {
    privateEgress: StringParameter.valueFromLookup(
      scope,
      SsmKeys.securityGroups.privateEgressId,
    ),
    privateIsolated: StringParameter.valueFromLookup(
      scope,
      SsmKeys.securityGroups.privateIsolated,
    ),
  };

  return {
    vpc: Vpc.fromLookup(scope, "Vpc", { vpcId }),
    securityGroups: {
      privateEgress: SecurityGroup.fromLookupById(
        scope,
        "PrivateEgressSecurityGroup",
        securityGroups.privateEgress,
      ),
      privateIsolated: SecurityGroup.fromLookupById(
        scope,
        "PrivateIsolatedSecurityGroup",
        securityGroups.privateIsolated,
      ),
    },
  };
}
