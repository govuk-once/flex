import { IsoDateTime, NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const EventsQuerySchema = z.object({
  namespace: z.literal("travel"),
  group: NonEmptyString,
});

export const EventSchema = z.object({
  namespace: z.literal("travel"),
  group: z.string(),
  eventNote: z.string(),
  eventTimestamp: IsoDateTime,
});

export const EventsResponseSchema = z.array(EventSchema);

export type Event = z.infer<typeof EventSchema>;
