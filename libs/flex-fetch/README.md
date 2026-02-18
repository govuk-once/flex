# @flex/flex-fetch

Lightweight wrapper around `fetch` that adds exponential backoff retries with jitter and a simple `AbortController` to cancel the in-flight request and stop further retries. Also provides AWS Signature V4 (SigV4) signed fetch for private API Gateway and similar endpoints.

## Install

- Monorepo: add as a workspace dependency.

```bash
pnpm add @flex/flex-fetch
```

## API

### flexFetch

- **Function:** `flexFetch(url, options?, fetcher?)`
- **Returns:** `{ request: Promise<Response>; abort: () => void }`

### Options (`FlexFetchRequestInit`)

- **`retryAttempts`**: number of attempts, capped at 5. If omitted, no retries are performed.
- **`maxRetryDelay`**: maximum delay between retries in ms. Clamped to 10-1000 ms.
- **Other `RequestInit`**: any standard fetch options (`method`, `headers`, `body`, etc.).

### createSigv4Fetcher

Creates a signed fetch wrapper for AWS API Gateway (`execute-api`) and compatible endpoints. Use when you already have credentials (e.g. from the environment or explicit credentials).

- **Function:** `createSigv4Fetcher(options)`
- **Returns:** `{ request: Promise<Response>; abort: () => void }`
- **Options:** `baseUrl` (string | URL), `region?`, `credentials?`, `fetchOptions?` (retry, headers, etc.)

### createSigv4FetchWithCredentials

Same as `createSigv4Fetcher` but assumes an IAM role via `STS AssumeRole` to obtain credentials. Credentials are cached per `roleArn` and `externalId`.

- **Function:** `createSigv4FetchWithCredentials(options)`
- **Returns:** `{ request: Promise<Response>; abort: () => void }`
- **Options:** `baseUrl`, `region?`, `roleArn` (required), `roleName?`, `externalId?`, `fetchOptions?`

### Behavior

- Uses `exponential-backoff` with `full` jitter.
- Delay per retry is clamped between 10 ms and 1000 ms.
- Abort: calling `abort()` cancels the current `fetch` and prevents further retries.
- Errors: the `request` Promise rejects with the last error after retries are exhausted.

## Usage

### Basic request

```ts
import { flexFetch } from "@flex/flex-fetch";

const { request } = flexFetch(new URL("https://api.example.com/data"));

const res = await request;
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const json = await res.json();
```

### With options

```ts
const { request } = flexFetch(new URL("https://api.example.com/data"), {
  // Values above 5 are capped at 5
  retryAttempts: 5,
  maxRetryDelay: 500,
  headers: { Accept: "application/json" },
});

const data = await (await request).json();
```

### Abort a slow request

```ts
const { request, abort } = flexFetch(new URL("https://api.example.com/slow"));

// Abort if it takes longer than 2 seconds
const timeout = setTimeout(() => abort(), 2000);

try {
  const res = await request;
  clearTimeout(timeout);
  // ... handle response
} catch (err) {
  clearTimeout(timeout);
  // On abort, fetch typically throws an AbortError
}
```

### SigV4 signed fetch (private API Gateway)

Use `createSigv4Fetcher` when calling private API Gateway. Credentials come from the default provider chain (e.g. Lambda execution role, env vars).

```ts
import { createSigv4Fetcher } from "@flex/flex-fetch";

const fetcher = createSigv4Fetcher({
  baseUrl: "https://abc123.execute-api.eu-west-2.amazonaws.com/prod",
  region: "eu-west-2",
  fetchOptions: {
    retryAttempts: 3,
    headers: { "Content-Type": "application/json" },
  },
});

const { request } = fetcher;
const res = await request;
const data = await res.json();
```

### SigV4 with assumed-role credentials

Use `createSigv4FetchWithCredentials` when you need to assume an IAM role to obtain credentials (e.g. cross-account access). Credentials are cached per role.

```ts
import { createSigv4FetchWithCredentials } from "@flex/flex-fetch";

const fetcher = createSigv4FetchWithCredentials({
  baseUrl: "https://private-api.example.com/prod",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/api-gateway-invoker",
  roleName: "my-session",
  externalId: "optional-external-id",
  fetchOptions: { retryAttempts: 3 },
});

const { request } = fetcher;
const res = await request;
```

## Notes & Gotchas

- **Retries count:** Retries are only enabled when `retryAttempts` is provided. Attempts are capped at 5.
- **Logging on failure:** Async failures after all retries won’t be caught by the function’s `try/catch`. Log at the call site by attaching `.catch(...)` to the returned `request` Promise if you need error telemetry.

- **SigV4 service:** Requests are signed for the `execute-api` service (API Gateway). For Lambda Function URLs, use `aws-sigv4-fetch` directly or pass a custom fetcher to `flexFetch`.
- **Credentials caching:** `createSigv4FetchWithCredentials` caches credential providers per `roleArn` and `externalId`. Repeated calls with the same role reuse the same provider.

## Under the Hood

- Backoff powered by `exponential-backoff` with `numOfAttempts`, `maxDelay`, and `jitter: "full"`.
- Abort is handled via `AbortController`; once aborted, the backoff `retry()` returns `false` to stop further attempts.
