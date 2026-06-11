import type { Mock } from "vitest";
import { vi } from "vitest";

import type {
  CreateSigv4FetchWithCredentialsOptions,
  Sigv4FetcherOptions,
} from "../sigv4";

// flexFetch and typedFetch are re-exported real because they are thin wrappers
// around global fetch — tests intercept at the fetch level (e.g. nock/msw).
// createSigv4Fetcher and createSigv4FetchWithCredentials are stubbed because
// they pull in @aws-sdk/credential-providers and SigV4 signing internals that
// don't belong in unit tests.
export { flexFetch } from "../fetch";
export { typedFetch } from "../typed-fetch";

/** Strips SigV4 signing — delegates to plain `fetch` so nock can intercept. */
export const createSigv4Fetcher: (
  opts: Sigv4FetcherOptions,
) => (
  path: string,
  options?: RequestInit,
) => { request: Promise<Response>; abort: Mock } =
  ({ baseUrl }) =>
  (path, options?) => ({
    request: fetch(`${baseUrl}${path}`, options),
    abort: vi.fn(),
  });

/** Strips STS role-assumption — delegates to plain `fetch` so nock can intercept. */
export const createSigv4FetchWithCredentials: (
  opts: CreateSigv4FetchWithCredentialsOptions,
) => (
  path: string,
  options?: RequestInit,
) => { request: Promise<Response>; abort: Mock } =
  ({ baseUrl }) =>
  (path, options?) => ({
    request: fetch(`${baseUrl}${path}`, options),
    abort: vi.fn(),
  });
