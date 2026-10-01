export interface Page<T> {
  items: T[];
  nextToken?: string;
}

export async function collectPages<T>(
  fetchPage: (nextToken?: string) => Promise<Page<T>>,
  nextToken?: string,
): Promise<T[]> {
  const page = await fetchPage(nextToken);
  const rest = page.nextToken
    ? await collectPages(fetchPage, page.nextToken)
    : [];

  return [...page.items, ...rest];
}
