import type {
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { DynamoDBUsageError } from "./errors";

// ----------------------------------------------------------------------------
// Attribute placeholders
// ----------------------------------------------------------------------------

type AttributeNamePlaceholder = `#${string}`;
type AttributeValuePlaceholder = `:${string}`;

type CommandExpressionAttributes = Pick<
  QueryCommandInput,
  "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

export interface ExpressionAttributes {
  readonly name: (attribute: string) => AttributeNamePlaceholder;
  readonly value: (value: unknown) => AttributeValuePlaceholder;
  readonly build: () => CommandExpressionAttributes;
}

export function createExpressionAttributes(): ExpressionAttributes {
  const names = new Map<string, AttributeNamePlaceholder>();
  const values = new Map<AttributeValuePlaceholder, unknown>();

  return {
    name: (attribute) => {
      const existing = names.get(attribute);

      if (existing) return existing;

      const placeholder: AttributeNamePlaceholder = `#${String(names.size)}`;

      names.set(attribute, placeholder);

      return placeholder;
    },
    value: (value) => {
      const placeholder: AttributeValuePlaceholder = `:${String(values.size)}`;

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

// ----------------------------------------------------------------------------
// Predicates
// ----------------------------------------------------------------------------

const definedEntries = (predicates: object): [string, unknown][] =>
  Object.entries<unknown>(predicates as Record<string, unknown>).filter(
    ([, value]) => value !== undefined,
  );

const toEquality = (
  attribute: string,
  value: unknown,
  attributes: ExpressionAttributes,
) => `${attributes.name(attribute)} = ${attributes.value(value)}`;

export function toFilterExpression(
  filter: object | undefined,
  attributes: ExpressionAttributes,
): string | undefined {
  const entries = definedEntries(filter ?? {});

  if (entries.length === 0) return;

  return entries
    .map(([attribute, value]) => toEquality(attribute, value, attributes))
    .join(" AND ");
}

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------

const MAX_KEY_ATTRIBUTES = 2;

function toKeyEntries(key: object): [string, unknown][] {
  const entries = definedEntries(key);

  if (entries.length === 0) {
    throw new DynamoDBUsageError("A key must name the partition key");
  }

  if (entries.length > MAX_KEY_ATTRIBUTES) {
    throw new DynamoDBUsageError(
      "A key may only name the partition key and the sort key",
    );
  }

  return entries;
}

export function toKeyAttributes(key: object): Record<string, unknown> {
  return Object.fromEntries(toKeyEntries(key));
}

export function toKeyConditionExpression(
  key: object,
  attributes: ExpressionAttributes,
): string {
  return toKeyEntries(key)
    .map(([attribute, value]) => toEquality(attribute, value, attributes))
    .join(" AND ");
}

// ----------------------------------------------------------------------------
// Commands
// ----------------------------------------------------------------------------

type ScanExpressions = Pick<
  ScanCommandInput,
  "ExpressionAttributeNames" | "ExpressionAttributeValues" | "FilterExpression"
>;

export function toScanExpressions(filter?: object): ScanExpressions {
  const attributes = createExpressionAttributes();

  const FilterExpression = toFilterExpression(filter, attributes);

  return {
    ...(FilterExpression && { FilterExpression }),
    ...attributes.build(),
  };
}

type UpdateExpressions = Pick<
  UpdateCommandInput,
  "ExpressionAttributeNames" | "ExpressionAttributeValues" | "UpdateExpression"
>;

export function toUpdateExpressions(
  key: object,
  set: object | undefined,
  remove: readonly string[] = [],
): UpdateExpressions {
  const attributes = createExpressionAttributes();

  const assignments = definedEntries(set ?? {});
  const removals = [...new Set(remove)];

  if (assignments.length === 0 && removals.length === 0) {
    throw new DynamoDBUsageError(
      "An update must set or remove at least one attribute",
    );
  }

  const assigned = new Set(assignments.map(([attribute]) => attribute));
  const overlapping = removals.filter((attribute) => assigned.has(attribute));

  if (overlapping.length > 0) {
    throw new DynamoDBUsageError(
      `An update cannot both set and remove ${overlapping.join(", ")}`,
    );
  }

  const keyed = new Set(toKeyEntries(key).map(([attribute]) => attribute));

  const altered = [...assigned, ...removals].filter((attribute) =>
    keyed.has(attribute),
  );

  if (altered.length > 0) {
    throw new DynamoDBUsageError(
      `An update cannot alter the primary key: ${altered.join(", ")}`,
    );
  }

  const clauses = [
    ...(assignments.length > 0
      ? [
          `SET ${assignments
            .map(
              ([attribute, value]) =>
                `${attributes.name(attribute)} = ${attributes.value(value)}`,
            )
            .join(", ")}`,
        ]
      : []),
    ...(removals.length > 0
      ? [
          `REMOVE ${removals.map((attribute) => attributes.name(attribute)).join(", ")}`,
        ]
      : []),
  ];

  return { UpdateExpression: clauses.join(" "), ...attributes.build() };
}

type QueryExpressions = Pick<
  QueryCommandInput,
  | "ExpressionAttributeNames"
  | "ExpressionAttributeValues"
  | "FilterExpression"
  | "KeyConditionExpression"
>;

export function toQueryExpressions(
  key: object,
  filter?: object,
): QueryExpressions {
  const attributes = createExpressionAttributes();

  const KeyConditionExpression = toKeyConditionExpression(key, attributes);
  const FilterExpression = toFilterExpression(filter, attributes);

  return {
    KeyConditionExpression,
    ...(FilterExpression && { FilterExpression }),
    ...attributes.build(),
  };
}
