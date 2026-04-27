import type { DomainResource } from "@flex/sdk";
import { type IKey, Key } from "aws-cdk-lib/aws-kms";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { type ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { applyCheckovSkip } from "./applyCheckovSkip";
import { createHash } from "./create-hash";
import { getParamName, getStageParamName } from "./getParamName";

export type ImportedResource =
  | { readonly type: "secret"; readonly construct: ISecret }
  | { readonly type: "ssm"; readonly construct: IStringParameter }
  | { readonly type: "ssm:runtime"; readonly construct: IStringParameter }
  | { readonly type: "kms"; readonly construct: IKey };

export type ImportedResources = ReadonlyMap<string, ImportedResource>;

/**
 * These importers directly reference AWS resources using CDK lookup methods
 * and bypass the SsmApp dependency graph. They are intentionally used for
 * resources that are managed outside the Flex stack lifecycle (e.g. secrets
 * and parameters written by flex-params or UDP). Do not use these for
 * resources owned by another Flex stack - use BaseStack.import() instead.
 */
function importFlexKmsKeyAlias(scope: Construct, kmsKeyAlias: string) {
  return Key.fromLookup(scope, `FlexKmsKeyAlias${createHash(kmsKeyAlias)}`, {
    aliasName: `alias${getParamName(kmsKeyAlias)}`,
  });
}

function importFlexSecret(scope: Construct, secret: string) {
  return Secret.fromSecretNameV2(
    scope,
    `FlexSecret${createHash(secret)}`,
    getParamName(secret),
  );
}

function importFlexParameter(scope: Construct, param: string) {
  return StringParameter.fromStringParameterName(
    scope,
    `FlexParam${createHash(param)}`,
    getParamName(param),
  );
}

function importResource(
  scope: Construct,
  { type, path, scope: resourceScope }: DomainResource,
): ImportedResource {
  const isStageScoped = resourceScope === "stage";

  switch (type) {
    case "kms":
      return {
        type: "kms",
        construct: importFlexKmsKeyAlias(scope, path),
      };
    case "secret":
      return {
        type: "secret",
        construct: importFlexSecret(
          scope,
          isStageScoped ? getStageParamName(path) : path,
        ),
      };
    case "ssm":
    case "ssm:runtime":
      return {
        type,
        construct: isStageScoped
          ? StringParameter.fromStringParameterName(
              scope,
              `EphemeralParam${createHash(path)}`,
              getStageParamName(path),
            )
          : importFlexParameter(scope, path),
      };
    default:
      // This should never happen due to schema validation, but we need this to satisfy the return type
      throw new Error(`Unsupported resource type: ${type as string}`);
  }
}

export function importResources(
  scope: Construct,
  references: ReadonlyMap<string, DomainResource>,
): ImportedResources {
  const cache = new Map<string, ImportedResource>();

  return new Map(
    Array.from(references).map(([key, resource]) => {
      const cached = cache.get(resource.path);

      if (cached) return [key, cached] as const;

      const value = importResource(scope, resource);

      cache.set(resource.path, value);

      return [key, value] as const;
    }),
  );
}

interface RouteResource {
  keys: readonly string[];
  resources: ImportedResources;
}

export function grantRouteResources(
  target: NodejsFunction,
  { keys, resources }: RouteResource,
) {
  keys.forEach((key) => {
    const resource = resources.get(key);

    if (!resource) {
      throw new Error(
        `"${key}" was referenced in "resources" but has not been resolved`,
      );
    }

    const { type, construct } = resource;

    switch (type) {
      case "kms":
        construct.grantDecrypt(target);
        target.addEnvironment(key, construct.keyArn);
        break;
      case "secret":
        construct.grantRead(target);
        target.addEnvironment(key, construct.secretName);
        break;
      case "ssm":
        construct.grantRead(target);
        target.addEnvironment(key, construct.stringValue);
        break;
      case "ssm:runtime":
        construct.grantRead(target);
        target.addEnvironment(key, construct.parameterName);
        break;
      default:
        // This should never happen due to schema validation
        throw new Error(`Unsupported resource type: ${type as string}`);
    }
  });

  applyCheckovSkip(
    target,
    "CKV_AWS_45",
    "Resources resolved at runtime can contain terms that sound suspicious but are not actual secret values",
  );
}
