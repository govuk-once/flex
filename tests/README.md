# Tests Directory

This directory contains integration and end-to-end (e2e) tests for the FLEX platform.

## Structure

```
tests/
├── e2e/          # End-to-end tests - test complete system flows
...
```

## Test Types

### E2E Tests (`tests/e2e/`)

End-to-end tests verify complete user flows and system behaviours from start to finish. These tests:

- Test the entire system as a black box
- May use real or mocked AWS services
- Have longer timeouts (30s default)
- Should be independent and clean up after themselves

**When to use E2E tests:**

- Testing complete user journeys
- Verifying system behaviour with real dependencies
- Validating deployment configurations

## Running Tests

### Run all tests

```bash
# E2E tests
pnpm --filter @flex/e2e test
```

### Run in watch mode

```bash
pnpm --filter @flex/e2e test --watch
```

### Run specific test file

```bash
pnpm --filter @flex/e2e test src/domains/example/example.e2e.test.ts
```

## Test Organisation

Organise tests by:

- **Domain**: `src/domains/<domain-name>/` - Tests specific to a domain
- **Libraries**: `src/libs/<lib-name>/` - Library integration tests
- **Fixtures**: `src/fixtures/` - Shared test data and helpers
- **Utils**: `src/utils/` - Test utilities and helpers

## Best Practices

1. **Test Independence**: Each test should be able to run independently and in any order
2. **Cleanup**: Always clean up resources (mocks, test data, etc.) after tests
3. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
5. **Isolation**: Tests should not depend on each other or shared state

## CI/CD Integration

These tests can be run in CI/CD pipelines:

```bash
# Run all tests (unit + integration + e2e)
pnpm test

# Run only e2e tests
pnpm --filter @flex/e2e test:run
```
