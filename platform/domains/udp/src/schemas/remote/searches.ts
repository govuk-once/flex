import { z } from "zod";

import { userSearchesSchema } from "../domain/searches";

export const searchesResponseSchema = z.object({ data: userSearchesSchema });
export const GroupsResponseSchema = z.object({
  data: z.object({
      groups: userSearchesSchema,
  }),
});
