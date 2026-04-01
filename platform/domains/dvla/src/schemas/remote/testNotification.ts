import z from "zod";

import { commonRequestSchema } from "../common";

export type PostTestNotificationRequestSchema = z.infer<
  typeof commonRequestSchema
>;
