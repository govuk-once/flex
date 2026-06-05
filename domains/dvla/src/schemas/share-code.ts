import type { ShareCodeSchema } from "@flex/dvla-service-gateway";
import {
  MultiShareCodeResponseSchemaWithoutIdSchmea,
  SingleShareCodeResponseSchemaWithoutIdSchema,
} from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export type ShareCode = z.output<typeof ShareCodeSchema>;

export const SingleShareCodeSchema =
  SingleShareCodeResponseSchemaWithoutIdSchema;
export type SingleShareCode = z.output<typeof SingleShareCodeSchema>;

export const MultiShareCodeSchema = MultiShareCodeResponseSchemaWithoutIdSchmea;
export type MultiShareCode = z.output<typeof MultiShareCodeSchema>;
