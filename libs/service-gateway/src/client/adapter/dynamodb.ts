import { DynamoDBClient as AwsDynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
  QueryCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { logger } from "@flex/logging";
import { getAssumedRoleCredentials } from "@flex/sdk";
import { assertNever } from "@flex/utils";
import { z } from "zod";

type AuthOptions =
  | { readonly type: "default" }
  | {
      readonly type: "role";
      readonly roleArn: string;
      readonly roleName: string;
      readonly externalId?: string;
    };

interface BuildDocumentClientOptions {
  readonly auth: AuthOptions;
  readonly region: string;
}

function buildDocumentClient({
  auth,
  region,
}: BuildDocumentClientOptions): DynamoDBDocumentClient {
  const { type } = auth;

  switch (type) {
    case "default": {
      return DynamoDBDocumentClient.from(new AwsDynamoDBClient({ region }));
    }
    case "role": {
      const { roleArn, roleName, externalId } = auth;

      return DynamoDBDocumentClient.from(
        new AwsDynamoDBClient({
          region,
          credentials: getAssumedRoleCredentials({
            region,
            roleArn,
            roleName,
            externalId,
          }),
        }),
      );
    }
    default:
      return assertNever(auth);
  }
}

interface ClientOptions<Schema extends z.ZodType> {
  readonly table: string;
  readonly region: string;
  readonly auth: AuthOptions;
  readonly schema: Schema;
}

type Condition<Item> = {
  readonly [Attribute in keyof Item]?: Item[Attribute];
};

interface ScanOptions<Item> {
  readonly indexName?: string;
  readonly filter?: Condition<Item>;
}

interface QueryOptions<Item> {
  readonly key: Condition<Item>;
  readonly indexName?: string;
  readonly filter?: Condition<Item>;
  readonly sort?: "asc" | "desc";
}

export interface DynamoDBClient<Item> {
  readonly scan: (options?: ScanOptions<Item>) => Promise<Item[]>;
  readonly query: (options: QueryOptions<Item>) => Promise<Item[]>;
}

export function createDynamoDBClient<Schema extends z.ZodType>({
  table,
  region,
  auth,
  schema,
}: ClientOptions<Schema>): DynamoDBClient<z.output<Schema>> {
  const documentClient = buildDocumentClient({ auth, region });

  const items = z.array(schema);

  return {
    scan: async ({ indexName, filter } = {}) => {
      const input = {
        TableName: table,
        ...(indexName && { IndexName: indexName }),
        ...toScanExpressions(filter),
      };
      const command = new ScanCommand(input);

      logger.info("Scan input", input);

      const result = await documentClient.send(command);

      return items.parse(result.Items ?? []);
    },
    query: async ({ key, indexName, filter, sort }) => {
      const input = {
        TableName: table,
        ...(indexName && { IndexName: indexName }),
        ...(sort && { ScanIndexForward: sort === "asc" }),
        ...toQueryExpressions(key, filter),
      };
      const command = new QueryCommand(input);

      logger.info("Query input", input);

      const result = await documentClient.send(command);

      return items.parse(result.Items ?? []);
    },
  };
}

// ----------------------------------------------------------------------------
// Expressions
// ----------------------------------------------------------------------------

type AttributeNamePlaceholder = `#${string}`;
type AttributeValuePlaceholder = `:${string}`;

const toAttributeNamePlaceholder = (index: number): AttributeNamePlaceholder =>
  `#${String(index)}`;

const toAttributeValuePlaceholder = (
  index: number,
): AttributeValuePlaceholder => `:${String(index)}`;

type CommandExpressionAttributes = Pick<
  QueryCommandInput,
  "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

interface ExpressionAttributes {
  readonly name: (attribute: string) => AttributeNamePlaceholder;
  readonly value: (value: unknown) => AttributeValuePlaceholder;
  readonly build: () => CommandExpressionAttributes;
}

function createExpressionAttributes(): ExpressionAttributes {
  const names = new Map<string, AttributeNamePlaceholder>();
  const values = new Map<AttributeValuePlaceholder, unknown>();

  return {
    name: (attribute) => {
      const existingPlaceholder = names.get(attribute);

      if (existingPlaceholder) return existingPlaceholder;

      const placeholder = toAttributeNamePlaceholder(names.size);

      names.set(attribute, placeholder);

      return placeholder;
    },
    value: (value) => {
      const placeholder = toAttributeValuePlaceholder(values.size);

      values.set(placeholder, value);

      return placeholder;
    },
    build: () => ({
      ...(names.size > 0 && {
        ExpressionAttributeNames: Object.fromEntries(
          [...names].map(([attribute, placeholder]) => [
            placeholder,
            attribute,
          ]),
        ),
      }),
      ...(values.size > 0 && {
        ExpressionAttributeValues: Object.fromEntries(values),
      }),
    }),
  };
}

type AttributePredicates = Readonly<Record<string, unknown>>;

function toPredicateExpression(
  condition: AttributePredicates | undefined,
  attributes: ExpressionAttributes,
) {
  const entries = Object.entries(condition ?? {});

  if (entries.length === 0) return;

  return entries
    .map(
      ([attribute, value]) =>
        `${attributes.name(attribute)} = ${attributes.value(value)}`,
    )
    .join(" AND ");
}

type ScanExpressions = Pick<
  ScanCommandInput,
  "ExpressionAttributeNames" | "ExpressionAttributeValues" | "FilterExpression"
>;

function toScanExpressions(filter?: AttributePredicates): ScanExpressions {
  const attributes = createExpressionAttributes();

  const FilterExpression = toPredicateExpression(filter, attributes);

  return {
    ...(FilterExpression && { FilterExpression }),
    ...attributes.build(),
  };
}

type QueryExpressions = Pick<
  QueryCommandInput,
  | "ExpressionAttributeNames"
  | "ExpressionAttributeValues"
  | "FilterExpression"
  | "KeyConditionExpression"
>;

function toQueryExpressions(
  key: AttributePredicates,
  filter?: AttributePredicates,
): QueryExpressions {
  const attributes = createExpressionAttributes();

  const KeyConditionExpression = toPredicateExpression(key, attributes);
  const FilterExpression = toPredicateExpression(filter, attributes);

  return {
    ...(KeyConditionExpression && { KeyConditionExpression }),
    ...(FilterExpression && { FilterExpression }),
    ...attributes.build(),
  };
}
