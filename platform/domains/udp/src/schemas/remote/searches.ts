import { z } from "zod";

import { userSearchesSchema } from "../domain/searches";

export const UpsertSearchesResponseSchema = z.object({ data: userSearchesSchema });
export type UpsertSearchesResponse = z.infer<typeof UpsertSearchesResponseSchema>;
