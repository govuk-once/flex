import { z } from "zod";

import {
  UnsGroupsGetRequestSchema,
  UnsGroupsPostRequestSchema,
  UnsGroupsRequestBodySchema,
  UnsGroupsResponseSchema,
} from "../domain/groups";

export type UnsGroupsGetRequestSchema = z.infer<
  typeof UnsGroupsGetRequestSchema
>;
export type UnsGroupsRequestBody = z.infer<typeof UnsGroupsRequestBodySchema>;
export type UnsGroupsPostRequestSchema = z.infer<
  typeof UnsGroupsPostRequestSchema
>;
export type UnsGroupsResponseSchema = z.infer<typeof UnsGroupsResponseSchema>;
