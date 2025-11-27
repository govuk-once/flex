# UDP In-memory Stub

This lambda emulates the User Data Platform (UDP) API so that other services can exercise the integration without calling the real platform. It keeps user topic records in-memory inside the Lambda execution environment, which keeps the behaviour close to the live networked dependency while remaining completely isolated.

## Supported operations

| Method | Path          | Description                    |
| ------ | ------------- | ------------------------------ |
| GET    | `/users/{id}` | Returns the stored topic data. |
| PUT    | `/users/{id}` | Creates or replaces topic data |
| DELETE | `/users/{id}` | Deletes topic data             |

All responses include permissive CORS headers so the stub can be invoked from browsers during manual testing.

## Environment variables

| Name                  | Default | Purpose                                                                                                                                                |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UDP_STUB_SEED_DATA`  | _unset_ | Optional JSON used to preload data. Accepts either an object (`{"user-123": { "data": ... }}`) or an array (`[{ "userId": "...", "data": { ... } }]`). |
| `UDP_STUB_LATENCY_MS` | `0`     | Adds an artificial delay (in milliseconds) to every request to better mimic a real network trip.                                                       |
