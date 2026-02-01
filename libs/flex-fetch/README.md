# @flex/flex-fetch

Lightweight wrapper around `fetch` that adds exponential backoff retries with jitter and a simple `AbortController` to cancel the in‑flight request and stop further retries.

## Install

- Monorepo: add as a workspace dependency.

```bash
pnpm add @flex/flex-fetch
```

Requires Node 18+ (global `fetch`) or a compatible `fetch` polyfill.

## API

- **Function:** `flexFetch(url, options?)`
- **Returns:** `{ request: Promise<Response>; abort: () => void }`

### Options (`FlexFetchRequestInit`)

- **`retryAttempts`**: number up to 5. Currently the implementation always retries up to 5 attempts (values < 5 are treated as 5).
- **`maxRetryDelay`**: maximum delay between retries in ms. Clamped to 10–1000 ms.
- **Other `RequestInit`**: any standard fetch options (`method`, `headers`, `body`, etc.).

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
  // Note: values < 5 are treated as 5 attempts in current implementation
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

## Notes & Gotchas

- **Retries count:** The current implementation enforces at least 5 attempts. If you need fewer attempts, change the clamp to use `Math.min(retryAttempts ?? 1, MAX_ATTEMPTS)` in `src/index.ts`.
- **Logging on failure:** Async failures after all retries won’t be caught by the function’s `try/catch`. Log at the call site by attaching `.catch(...)` to the returned `request` Promise if you need error telemetry.
- **Environment:** In Node < 18, install a `fetch` polyfill (e.g. `undici`).

## Under the Hood

- Backoff powered by `exponential-backoff` with `numOfAttempts`, `maxDelay`, and `jitter: "full"`.
- Abort is handled via `AbortController`; once aborted, the backoff `retry()` returns `false` to stop further attempts.
