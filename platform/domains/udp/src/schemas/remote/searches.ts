import { DomainGroupsSchema } from "../domain/groups";
import { userSearchesSchema } from "../domain/searches";
import { z } from "zod";

export const searchesResponseSchema = z.object({ data: userSearchesSchema });
export const GroupsResponseSchema = z.object({
  data: z.object({
    groups: DomainGroupsSchema,
  }),
});
