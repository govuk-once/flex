import { IsoDateTime, NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const TravelEventItemSchema = z.object({
  compositeKey: NonEmptyString,
  namespace: z.literal("travel"),
  group: NonEmptyString,
  eventNote: NonEmptyString,
  eventTimestamp: IsoDateTime,
});
export type TravelEventItem = z.output<typeof TravelEventItemSchema>;

export const TravelEventSchema = TravelEventItemSchema.omit({
  compositeKey: true,
}).meta({ id: "TravelEvent" });
export type TravelEvent = z.output<typeof TravelEventSchema>;

export const GetEventsQuerySchema = z
  .object({ namespace: z.literal("travel"), group: NonEmptyString })
  .meta({ id: "GetEventsQuery" });
export type GetEventsQuery = z.output<typeof GetEventsQuerySchema>;

export const GetEventsResponseSchema = z
  .array(TravelEventSchema)
  .meta({ id: "GetEventsResponse" });
export type GetEventsResponse = z.output<typeof GetEventsResponseSchema>;

export function toTravelEvent(item: TravelEventItem): TravelEvent {
  const { compositeKey: _, ...event } = item;

  return event;
}
