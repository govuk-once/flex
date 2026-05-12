import z from "zod";

import { commonRequestSchema } from "../common";

export type UnlinkUserRequestSchema = z.infer<typeof commonRequestSchema>;
