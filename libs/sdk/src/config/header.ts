export function header<const Required extends boolean = true>(
  name: string,
  options?: { required: Required },
) {
  return { name, required: (options?.required ?? true) as Required };
}
