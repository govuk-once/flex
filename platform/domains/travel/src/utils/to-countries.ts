import type { Country } from "../schemas/domain/country";
import type { ForeignTravelAdviceResponse } from "../schemas/remote/foreign-travel-advice";

export function toCountries(advice: ForeignTravelAdviceResponse): Country[] {
  return advice.links.children.map((child) => ({
    countryId: child.content_id,
    countryName: child.details.country.name,
  }));
}
