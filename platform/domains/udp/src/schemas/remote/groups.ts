import { z } from "zod";

import { DomainGroupsSchema } from "../domain/groups";

export const GroupsResponseSchema = z.object({
  data: z.object({
    groups: DomainGroupsSchema,
  }),
});

export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;

export const UpsertGroupsRequestSchema = z.object({
  data: z.object({
    groups: DomainGroupsSchema,
  }),
});

export type UpsertGroupsRequest = z.infer<typeof UpsertGroupsRequestSchema>;

export const UpsertGroupsResponseSchema = z.object({
  data: z.object({
    groups: DomainGroupsSchema,
  }),
});

export type UpsertGroupsResponse = z.infer<typeof UpsertGroupsResponseSchema>;
