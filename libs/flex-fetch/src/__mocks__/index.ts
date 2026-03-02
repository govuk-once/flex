import type { Mock } from "vitest";
import { vi } from "vitest";

// flexFetch and typedFetch are re-exported real because they are thin wrappers
// around global fetch — tests intercept at the fetch level (e.g. nock/msw).
// createSigv4Fetcher is stubbed because it pulls in @aws-sdk/credential-providers
// and SigV4 signing internals that don't belong in unit tests.
export { flexFetch } from "../fetch";
export { typedFetch } from "../typed-fetch";

/** Strips SigV4 signing — delegates to plain `fetch` so nock can intercept. */
export const createSigv4Fetcher: (opts: {
  baseUrl: string;
}) => (
  path: string,
  options?: RequestInit,
) => { request: Promise<Response>; abort: Mock } =
  ({ baseUrl }) =>
  (path, options?) => ({
    request: fetch(`${baseUrl}${path}`, options),
    abort: vi.fn(),
  });

export const createSigv4FetchWithCredentials: Mock = vi.fn();
