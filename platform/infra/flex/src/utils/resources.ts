import type { DomainResource } from "@flex/sdk";
import type {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
} from "@platform/core/outputs";
import {
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import type { IResource } from "aws-cdk-lib/aws-apigateway";
import type { IKey } from "aws-cdk-lib/aws-kms";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import type { IStringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export type ImportedResource =
  | { readonly type: "secret"; readonly construct: ISecret }
  | { readonly type: "ssm"; readonly construct: IStringParameter }
  | { readonly type: "ssm:deferred"; readonly construct: IStringParameter }
  | { readonly type: "kms"; readonly construct: IKey };

export type ImportedResources = ReadonlyMap<string, ImportedResource>;

function importResource(
  scope: Construct,
  { type, path }: DomainResource,
): ImportedResource {
  switch (type) {
    case "kms":
      return {
        type: "kms",
        construct: importFlexKmsKeyAlias(scope, path as FlexKmsKeyAlias),
      };
    case "secret":
      return {
        type: "secret",
        construct: importFlexSecret(scope, path as FlexSecret),
      };
    case "ssm":
    case "ssm:deferred":
      return {
        type,
        construct: importFlexParameter(scope, path as FlexParam),
      };
    default:
      throw new Error(`Unsupported resource type: ${type}`);
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
      case "ssm:deferred":
        construct.grantRead(target);
        target.addEnvironment(key, construct.parameterName);
        break;
      default:
        throw new Error("Unsupported resource type");
    }
  });
}

export function resolveApiResource(target: IResource, path: string) {
  const parts = path.split("/").filter(Boolean);

  let current = target;

  for (const part of parts) {
    current =
      (current.node.tryFindChild(part) as IResource | undefined) ??
      current.addResource(part);
  }

  return current;
}
