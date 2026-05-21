/**
 * Removes linkingId from a response data object
 */
export const removeLinkingId = <T extends Record<string, unknown>>(
  data: T | null | undefined,
): Omit<T, "linkingId"> | null | undefined => {
  if (!data) return data;

  const { linkingId: _linkingId, ...rest } = data;
  return rest;
};
