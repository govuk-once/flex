export function sanitiseStageName(value?: string) {
  if (!value) return undefined;

  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 12);
}
