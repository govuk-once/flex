import { z } from "zod";

export const DvlaSecretSchema = z.object({
  apiUrl: z.string().min(1),
  apiKey: z.string().min(1),
  apiUsername: z.string().min(1),
  apiPassword: z.string().min(1),
  wellKnownJwkUrl: z.string().min(1),
});

export type DvlaSecret = z.infer<typeof DvlaSecretSchema>;
