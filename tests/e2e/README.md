# E2E Tests

This directory contains end-to-end tests for the FLEX platform.

## Structure

- `src/` - E2E test files
  - `domains/` - Domain-specific e2e tests
  - `integration/` - Cross-domain integration tests
  - `fixtures/` - Test fixtures and helpers
  - `utils/` - E2E test utilities

## Running Tests

```bash
# Run all e2e tests (requires API_GATEWAY_URL environment variable)
API_GATEWAY_URL=https://your-api-id.execute-api.eu-west-2.amazonaws.com pnpm --filter @flex/e2e test

# Run in watch mode
API_GATEWAY_URL=https://your-api-id.execute-api.eu-west-2.amazonaws.com pnpm --filter @flex/e2e test --watch

# Run specific test file
API_GATEWAY_URL=https://your-api-id.execute-api.eu-west-2.amazonaws.com pnpm --filter @flex/e2e test src/hello.e2e.test.ts
```

### Environment Variables

- `API_GATEWAY_URL` (required): The base URL of your deployed API Gateway
  - Example: `https://abc123xyz.execute-api.eu-west-2.amazonaws.com`
  - Get this from your AWS Console or CDK stack outputs

## Writing E2E Tests

E2E tests should:

- Test complete user flows or system behaviours
- Use real AWS services as appropriate
- Be independent and able to run in any order
- Clean up after themselves

Example:

```typescript
import { describe, it, expect } from "vitest";

describe("Example Domain E2E", () => {
  it("should handle complete request flow", async () => {
    // Your e2e test here
  });
});
```
