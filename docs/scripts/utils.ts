import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "../..");

export const toOpenApiPath = (p: string): string =>
  p.replace(/:(\w+)/g, "{$1}");

export const toExpressPath = (p: string): string =>
  p.replace(/\{(\w+)\}/g, ":$1");

export const extractRefName = (ref: string): string | undefined =>
  ref.split("/").pop();

export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  items.forEach((item) => {
    const key = keyFn(item);
    groups[key] ??= [];
    groups[key].push(item);
  });

  return groups;
}
