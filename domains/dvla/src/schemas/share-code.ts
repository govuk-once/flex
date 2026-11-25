import type {
  ShareCodeSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
} from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export {
  SingleShareCodeResponseSchema as ShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema as ShareCodeWithoutIdSchema,
} from "@flex/dvla-service-gateway";

export type SingleShareCode = z.output<
  typeof SingleShareCodeResponseSchemaWithoutIdSchema
>;
export type ShareCode = z.output<typeof ShareCodeSchema>;
