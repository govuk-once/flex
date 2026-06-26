import type { ApiResult } from "@flex/sdk";
import type { Json, QueryParams, ReadonlyRecord } from "@flex/utils";
import type { z } from "zod";

type HeaderMap = ReadonlyRecord<string, string | undefined>;

type ResolveOutput<Schema extends z.ZodType> = [Schema] extends [never]
  ? unknown
  : z.output<Schema>;

export interface RestReadOperationOptions<
  Schema extends z.ZodType = z.ZodType,
> {
  readonly query?: QueryParams;
  readonly headers?: HeaderMap;
  readonly schema?: Schema;
}

export type RestReadOperation = <Schema extends z.ZodType = never>(
  path: string,
  options?: RestReadOperationOptions<Schema>,
) => Promise<ApiResult<ResolveOutput<Schema>>>;

export interface RestWriteOperationOptions<
  Schema extends z.ZodType = z.ZodType,
  Body extends Json = Json,
> extends RestReadOperationOptions<Schema> {
  readonly body?: Body;
}

export type RestWriteOperation = <
  Schema extends z.ZodType = never,
  Body extends Json = Json,
>(
  path: string,
  options?: RestWriteOperationOptions<Schema, Body>,
) => Promise<ApiResult<ResolveOutput<Schema>>>;

export interface RestClient {
  readonly get: RestReadOperation;
  readonly post: RestWriteOperation;
  readonly put: RestWriteOperation;
  readonly patch: RestWriteOperation;
  readonly delete: RestReadOperation;
}
