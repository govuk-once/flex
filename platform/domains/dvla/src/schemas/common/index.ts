import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const commonRequestSchema = z.object({
  id: NonEmptyString,
  jwt: NonEmptyString,
});
