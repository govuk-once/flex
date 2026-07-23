import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { assertNever } from "@flex/utils";

import type {
  ResolvableResource,
  ResolvedResources,
  Resource,
  ResourceMap,
} from "../types";

export async function resolveResources<Resources extends ResourceMap>(
  resources: Resources,
) {
  const entries = await Promise.all(
    Object.entries(resources)
      .filter(isResolvableResource)
      .map(async ([key, resource]): Promise<[string, unknown]> => [
        key,
        await resolveResource(resource),
      ]),
  );

  return Object.fromEntries(entries) as ResolvedResources<Resources>;
}

function isResolvableResource(
  entry: [string, Resource],
): entry is [string, ResolvableResource] {
  const { type } = entry[1];

  switch (type) {
    case "secret":
      return true;
    case "kms":
    case "role":
    case "ssm":
      return false;
    default:
      return assertNever(type);
  }
}

async function resolveResource(resource: ResolvableResource) {
  const rawValue = await loadSecret(resolveArn(resource));

  return resource.config.parse(rawValue);
}

function resolveArn({ env, path }: ResolvableResource) {
  const value = process.env[env];

  if (!value) {
    throw new Error(
      `Environment variable "${env}" is not set, check if "${path}" exists`,
    );
  }

  return value;
}

async function loadSecret(arn: string) {
  const secret = await getSecret(arn, { maxAge: 600, transform: "json" });

  if (!secret) {
    throw new Error(`Secret not found: "${arn}"`);
  }

  return secret;
}
