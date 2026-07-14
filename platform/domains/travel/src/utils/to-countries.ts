import { Country } from "../schemas/domain/country";
import { ForeignTravelAdviceResponse } from "../schemas/remote/foreign-travel-advice";

export function toCountries(advice: ForeignTravelAdviceResponse): Country[] {
  return advice.links.children.map((child) => ({
    countryId: child.content_id,
    countryName: lastPathSegment(child.api_path),
  }));
}

function lastPathSegment(apiPath: string): string {
  const segments = apiPath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}
