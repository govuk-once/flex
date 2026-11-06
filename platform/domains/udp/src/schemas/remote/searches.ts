import { z } from "zod";

import { userSearchesSchema } from "../domain/searches";

export const searchesResponseSchema = z.object({ data: userSearchesSchema });
