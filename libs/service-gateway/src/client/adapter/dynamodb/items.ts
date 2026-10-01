import { z } from "zod";

import type { DynamoDBItemSchema } from "../../../types";
import { ItemInputError, ItemValidationError } from "./errors";

export const createItemParser =
  <Schema extends DynamoDBItemSchema>(schema: Schema) =>
  (item: unknown): z.output<Schema> => {
    const { success, data, error } = schema.safeParse(item);

    if (!success) throw new ItemValidationError(error);

    return data;
  };

export const createItemsParser =
  <Schema extends DynamoDBItemSchema>(schema: Schema) =>
  (items: unknown[]): z.output<Schema>[] => {
    const { success, data, error } = z.array(schema).safeParse(items);

    if (!success) throw new ItemValidationError(error);

    return data;
  };

export const createInputParser =
  <Schema extends DynamoDBItemSchema>(schema: Schema) =>
  (item: z.input<Schema>): z.output<Schema> => {
    const { success, data, error } = schema.safeParse(item);

    if (!success) throw new ItemInputError(error);

    return data;
  };

export async function collectItems(
  pages: AsyncIterable<{ Items?: Record<string, unknown>[] }>,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];

  for await (const { Items = [] } of pages) {
    items.push(...Items);
  }

  return items;
}

export const countItems = (items: unknown[]): number => items.length;
