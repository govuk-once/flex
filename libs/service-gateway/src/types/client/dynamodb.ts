import type { ApiResult } from "@flex/sdk";
import type { z } from "zod";

export type DynamoDBItemSchema = z.ZodType<Record<string, unknown>>;

export type DynamoDBAuth =
  | { readonly type: "default" }
  | {
      readonly type: "role";
      readonly roleArn: string;
      readonly roleName: string;
      readonly externalId?: string;
    };

export interface DynamoDBClientOptions<Schema extends DynamoDBItemSchema> {
  readonly table: string;
  readonly region: string;
  readonly auth: DynamoDBAuth;
  readonly schema: Schema;
}

export type DynamoDBCondition<Item> = {
  readonly [Attribute in keyof Item]?: Item[Attribute];
};

export type DynamoDBKey<Item> = {
  readonly [Attribute in keyof Item]?: Item[Attribute];
};

export interface DynamoDBScanOptions<Item> {
  readonly indexName?: string;
  readonly filter?: DynamoDBCondition<Item>;
}

export interface DynamoDBQueryOptions<Item> {
  readonly key: DynamoDBKey<Item>;
  readonly indexName?: string;
  readonly filter?: DynamoDBCondition<Item>;
  readonly sort?: "asc" | "desc";
}

export type DynamoDBAttributes<Item> = {
  readonly [Attribute in keyof Item]?: Item[Attribute];
};

export interface DynamoDBGetOptions<Item> {
  readonly key: DynamoDBKey<Item>;
}

export interface DynamoDBPutOptions<Input> {
  readonly item: Input;
}

export interface DynamoDBUpdateOptions<Item> {
  readonly key: DynamoDBKey<Item>;
  readonly set?: DynamoDBAttributes<Item>;
  readonly remove?: readonly (keyof Item)[];
}

export interface DynamoDBDeleteOptions<Item> {
  readonly key: DynamoDBKey<Item>;
}

export interface DynamoDBClient<Item, Input = Item> {
  readonly scan: (
    options?: DynamoDBScanOptions<Item>,
  ) => Promise<ApiResult<Item[]>>;
  readonly query: (
    options: DynamoDBQueryOptions<Item>,
  ) => Promise<ApiResult<Item[]>>;
  readonly get: (
    options: DynamoDBGetOptions<Item>,
  ) => Promise<ApiResult<Item | undefined>>;
  readonly put: (
    options: DynamoDBPutOptions<Input>,
  ) => Promise<ApiResult<Item>>;
  readonly update: (
    options: DynamoDBUpdateOptions<Item>,
  ) => Promise<ApiResult<Item>>;
  readonly delete: (
    options: DynamoDBDeleteOptions<Item>,
  ) => Promise<ApiResult<void>>;
}

export type AnyDynamoDBClient = DynamoDBClient<unknown, never>;
