import { z } from "zod";

import { DomainGroupsSchema } from "../domain/groups";

export const GroupsResponseSchema = z.object({
  data: z.object({
    groups: DomainGroupsSchema,
  }),
});

export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;

export const createOrUpdateGroupsRequestSchema = z.object({
  data: z.object({
    groups: domainGroupsSchema,
  }),
});

export type CreateOrUpdateGroupsRequest = z.infer<
  typeof createOrUpdateGroupsRequestSchema
>;

export const createOrUpdateGroupsResponseSchema = z.object({
  data: z.object({
    groups: domainGroupsSchema,
  }),
});

export type CreateOrUpdateGroupsResponse = z.infer<
  typeof createOrUpdateGroupsResponseSchema
>;
