import { HeaderValidationError } from "../errors";
import { HeaderConfig } from "../schemas/common";

type HeaderConfigs = Readonly<Record<string, HeaderConfig>>;
type RequestHeaders = Readonly<Record<string, string | undefined>>;

export function mergeHeaders(
  commonHeaders?: HeaderConfigs,
  overrideHeaders?: HeaderConfigs,
): HeaderConfigs | undefined {
  if (!commonHeaders && !overrideHeaders) return;

  const headers = { ...commonHeaders, ...overrideHeaders };

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function resolveHeaders(
  requestHeaders: RequestHeaders = {},
  headerConfigs?: HeaderConfigs,
) {
  if (!headerConfigs) return;

  const normalisedHeaders = normaliseHeaders(requestHeaders);

  const resolvedHeaders: Record<string, string | undefined> = {};
  const missingHeaders: string[] = [];

  for (const [key, { name, required }] of Object.entries(headerConfigs)) {
    const value = normalisedHeaders.get(name.toLowerCase());

    if (isRequiredHeaderMissing(required, value)) {
      missingHeaders.push(name);
    }

    resolvedHeaders[key] = value;
  }

  if (missingHeaders.length > 0) {
    throw new HeaderValidationError(missingHeaders);
  }

  return resolvedHeaders;
}

function isRequiredHeaderMissing(required?: boolean, value?: string) {
  return required !== false && !value;
}

function normaliseHeaders(headers: RequestHeaders) {
  return new Map(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([k, v]) => [k.toLowerCase(), v.trim()]),
  );
}
