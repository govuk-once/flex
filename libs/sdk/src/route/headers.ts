import type { HeaderConfig } from "../types";
import { HeaderValidationError } from "../utils/errors";

type RouteHeaders = Readonly<Record<string, HeaderConfig>>;
type EventHeaders = Readonly<Record<string, string | undefined>>;

function isRequiredHeader(required?: boolean, value?: string) {
  return required !== false && !value;
}

function normaliseEventHeaders(headers: EventHeaders) {
  return new Map(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([k, v]) => [k.toLowerCase(), v]),
  );
}

export function mergeHeaders(
  common?: RouteHeaders,
  route?: RouteHeaders,
): RouteHeaders | undefined {
  if (!common && !route) return;

  const headers = { ...common, ...route };

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function resolveHeaders(
  routeHeaders: RouteHeaders,
  eventHeaders: EventHeaders = {},
) {
  const normalisedEventHeaders = normaliseEventHeaders(eventHeaders);

  const headers: Record<string, string | undefined> = {};
  const missing: string[] = [];

  for (const [key, { name, required }] of Object.entries(routeHeaders)) {
    const value = normalisedEventHeaders.get(name.toLowerCase());

    if (isRequiredHeader(required, value)) missing.push(name);

    headers[key] = value;
  }

  if (missing.length > 0) throw new HeaderValidationError(missing);

  return headers;
}
