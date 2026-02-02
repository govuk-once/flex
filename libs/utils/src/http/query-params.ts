export type QueryParams = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

export function extractQueryParams(params: QueryParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((v) => {
      searchParams.append(key, String(v));
    });
  });

  return [searchParams.toString(), Object.fromEntries(searchParams)] as const;
}
