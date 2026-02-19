import { getEnvConfig } from "@platform/gov-uk-once";
import {
  InterfaceVpcEndpoint,
  ISecurityGroup,
  IVpc,
  IVpcEndpoint,
  SecurityGroup,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Key } from "aws-cdk-lib/aws-kms";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import crypto from "crypto";

const envConfig = getEnvConfig();

function getParamName(name: string) {
  return `/${envConfig.environment}${name}`;
}

function hash(string: string) {
  return crypto.createHash("md5").update(string).digest("hex").slice(0, 16);
}

/** VPC */
type VpcKey = "/flex-core/vpc";

export function exportVpcToSsm(
  scope: Construct,
  vpcKey: VpcKey,
  { vpcId }: IVpc,
) {
  new StringParameter(scope, `Vpc${hash(vpcKey)}`, {
    parameterName: getParamName(vpcKey),
    stringValue: vpcId,
  });
}

export function importVpcFromSsm(scope: Construct, vpcKey: VpcKey) {
  const vpcId = StringParameter.valueFromLookup(scope, getParamName(vpcKey));
  return Vpc.fromLookup(scope, `Vpc${hash(vpcKey)}`, { vpcId });
}

/** Security Groups */
type SecurityGroupKey =
  | "/flex-core/security-group/private-egress"
  | "/flex-core/security-group/private-isolated";

export function exportSecurityGroupToSsm(
  scope: Construct,
  SecurityGroupKey: SecurityGroupKey,
  { securityGroupId }: ISecurityGroup,
) {
  new StringParameter(scope, `SG${hash(SecurityGroupKey)}`, {
    parameterName: getParamName(SecurityGroupKey),
    stringValue: securityGroupId,
  });
}

export function importSecurityGroupFromSsm(
  scope: Construct,
  SecurityGroupKey: SecurityGroupKey,
) {
  const securityGroupId = StringParameter.valueFromLookup(
    scope,
    getParamName(SecurityGroupKey),
  );
  return SecurityGroup.fromLookupById(
    scope,
    `SG${hash(SecurityGroupKey)}`,
    securityGroupId,
  );
}

/** VPC Endpoint */
type VpcEndpointKey = "/flex-core/vpc-endpoint/api-gateway";

export function exportInterfaceVpcEndpointToSsm(
  scope: Construct,
  vpcEndpointKey: VpcEndpointKey,
  { vpcEndpointId }: IVpcEndpoint,
) {
  new StringParameter(scope, `VpcE${hash(vpcEndpointKey)}`, {
    parameterName: getParamName(vpcEndpointKey),
    stringValue: vpcEndpointId,
  });
}

export function importInterfaceVpcEndpointFromSsm(
  scope: Construct,
  vpcEndpointKey: VpcEndpointKey,
) {
  const vpcEndpointId = StringParameter.valueFromLookup(
    scope,
    getParamName(vpcEndpointKey),
  );
  return InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(
    scope,
    `VpcE${hash(vpcEndpointKey)}`,
    { port: 443, vpcEndpointId },
  );
}

/** Strings */
type StringKey = "/flex-core/cache/endpoint";

export function exportStringToSsm(
  scope: Construct,
  stringKey: StringKey,
  string: string,
) {
  new StringParameter(scope, `String${hash(stringKey)}`, {
    parameterName: getParamName(stringKey),
    stringValue: string,
  });
}

export function importStringFromSsm(scope: Construct, stringKey: StringKey) {
  return StringParameter.valueFromLookup(scope, getParamName(stringKey));
}

/** FLEX Params */
export type FlexParam =
  | "/flex-param/auth/user-pool-id"
  | "/flex-param/auth/client-id"
  | "/flex-param/udp/consumer-config-secret-arn"
  | "/flex-param/udp/cmk-arn"
  | "/flex-core/vpc-endpoint/api-gateway"
  | "/flex-param/udp/consumer-role-arn";

export function importFlexParameter(scope: Construct, param: FlexParam) {
  return StringParameter.fromStringParameterName(
    scope,
    `FlexParam${hash(param)}`,
    getParamName(param),
  );
}

/** Flex Secrets */
export type FlexSecret =
  | "/flex-secret/udp/notification-hash-secret"
  | "/flex-secret/udp/consumer-config-secret";

export function importFlexSecret(scope: Construct, secret: FlexSecret) {
  return Secret.fromSecretNameV2(
    scope,
    `FlexSecret${hash(secret)}`,
    getParamName(secret),
  );
}

/** Flex KMS Key Aliases */
export type FlexKmsKeyAlias = "/flex-secret/encryption-key";

export function importFlexKmsKeyAlias(
  scope: Construct,
  kmsKeyAlias: FlexKmsKeyAlias,
) {
  return Key.fromLookup(scope, `FlexKmsKeyAlias${hash(kmsKeyAlias)}`, {
    aliasName: `alias${getParamName(kmsKeyAlias)}`,
  });
}
