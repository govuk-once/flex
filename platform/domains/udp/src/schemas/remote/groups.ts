import { z } from "zod";

import { domainGroupsSchema } from "../domain/groups";

export const groupsResponseSchema = z.object({
  data: domainGroupsSchema,
});

export type GroupsResponse = z.infer<typeof groupsResponseSchema>;

export const createOrUpdateGroupsRequestSchema = z.object({
  data: domainGroupsSchema,
});

export type CreateOrUpdateGroupsRequest = z.infer<
  typeof createOrUpdateGroupsRequestSchema
>;

export const createOrUpdateGroupsResponseSchema = z.object({
  data: domainGroupsSchema,
});

export type CreateOrUpdateGroupsResponse = z.infer<
  typeof createOrUpdateGroupsResponseSchema
>;
