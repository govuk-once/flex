import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const HelloSchema = z.object({
  reponse: NonEmptyString,
});
type Hello = z.infer<typeof HelloSchema>;

export const GetHelloResponseSchema = HelloSchema;
export type { Hello as GetHelloResponse };
