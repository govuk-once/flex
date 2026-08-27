import type { ShareCodeSchema } from "@flex/dvla-service-gateway";
import {
  SingleShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
} from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export const ShareCodeResponseSchema = SingleShareCodeResponseSchema;
export const ShareCodeWithoutIdSchema =
  SingleShareCodeResponseSchemaWithoutIdSchema;

export type SingleShareCode = z.output<typeof ShareCodeWithoutIdSchema>;
export type ShareCode = z.output<typeof ShareCodeSchema>;
