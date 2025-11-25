# User Data Platform (UDP) Module

This module provides functionality to interact with the User Data Platform through a hexagonal architecture pattern. It supports GET, WRITE, and DELETE operations using OAuth2 client credentials authentication.

## Architecture

The module follows hexagonal architecture (ports and adapters) principles:

```
src/
  domain/
    models/          # Domain entities and value objects
    ports/           # Interfaces defining contracts
  application/
    use-cases/       # Business logic orchestration
  adapters/
    http/            # HTTP client adapter (shared resource)
    auth/            # OAuth2 client credentials provider
  entrypoints/
    lambdas/         # Lambda handlers for each operation
```
