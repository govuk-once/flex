import { z } from "zod";

import { identityRequestSchema } from "../inbound/identity";

export type identityRequest = z.infer<typeof identityRequestSchema>;
