import type { ShareCodeSchema } from "@flex/dvla-service-gateway";
import { SingleShareCodeResponseSchemaWithoutIdSchema } from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export type ShareCode = z.output<typeof ShareCodeSchema>;

export const SingleShareCodeSchema =
  SingleShareCodeResponseSchemaWithoutIdSchema;
export type SingleShareCode = z.output<typeof SingleShareCodeSchema>;
