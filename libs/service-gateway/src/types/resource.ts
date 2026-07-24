import type { Prettify, ReadonlyRecord, ResourceScope } from "@flex/utils";
import type { z } from "zod";

export type ResourceType = "kms" | "role" | "secret" | "ssm";

interface ResourceCommon {
  path: string;
  scope?: ResourceScope;
}

export interface KmsResource extends ResourceCommon {
  type: "kms";
}

export interface RoleResource extends ResourceCommon {
  type: "role";
}

export interface SecretResource extends ResourceCommon {
  type: "secret";
  env: string;
  config: z.ZodType;
}

export interface SsmResource extends ResourceCommon {
  type: "ssm";
  env?: string; // TODO
  config?: z.ZodType;
}

export type Resource =
  KmsResource | RoleResource | SecretResource | SsmResource;

export type ResourceMap = ReadonlyRecord<string, Resource>;

export type ResolvableResourceType = Extract<ResourceType, "secret">;

export type ResolvableResource = Extract<
  Resource,
  { type: ResolvableResourceType }
>;

export type ResolvedResources<Resources extends ResourceMap> = Prettify<{
  readonly [
    Key in keyof Resources as Resources[Key] extends ResolvableResource
      ? Key
      : never
  ]: Resources[Key] extends { config: infer Schema extends z.ZodType }
    ? z.output<Schema>
    : unknown;
}>;
