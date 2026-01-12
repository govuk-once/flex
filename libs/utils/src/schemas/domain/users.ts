import { z } from "zod";

import { Uuid } from "../common";

export const UserId = Uuid.meta({
  id: "UserId",
  description: "Unique identifier for a user",
  example: "[UUID v4]",
});
export type UserId = z.output<typeof UserId>;
