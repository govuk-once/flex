import type { ApiResult } from "@flex/sdk";
import type { z } from "zod";

type ResolveOutput<Schema extends z.ZodType> = [Schema] extends [never]
  ? unknown
  : z.output<Schema>;

export interface DynamoScanOptions<Schema extends z.ZodType = z.ZodType> {
  /** Attribute every returned item must match. */
  readonly attribute: string;
  /** Value that attribute must equal. */
  readonly value: string;
  /** Validates each returned item, stripping any attribute it does not declare. */
  readonly schema?: Schema;
}

/**
 * Reads every item whose `attribute` equals `value`, following pagination until
 * the table is exhausted.
 *
 * This is a Scan with a filter, so it reads the whole table and discards
 * non-matching items server-side. Use it only for tables where no key or index
 * can express the selection.
 */
export type DynamoScanOperation = <Schema extends z.ZodType = never>(
  options: DynamoScanOptions<Schema>,
) => Promise<ApiResult<ResolveOutput<Schema>[]>>;

export interface DynamoClient {
  readonly scan: DynamoScanOperation;
}
