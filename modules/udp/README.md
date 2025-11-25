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

## Structure

### Domain Layer

- **Models**: `UserData`, `UserDataResponse`, `WriteUserDataRequest`
- **Ports**:
  - `UserDataPlatformPort` - Contract for UDP operations
  - `AuthTokenProviderPort` - Contract for authentication

### Application Layer

- **Use Cases**:
  - `GetSettingsUseCase` - Retrieves user settings
  - `CreateSettingsUseCase` - Creates/updates user settings
  - `DeleteSettingsUseCase` - Deletes user settings

### Adapters Layer

- **UdpHttpClient** - Shared HTTP client implementing `UserDataPlatformPort`
- **ClientCredentialsProvider** - OAuth2 client credentials flow with token caching

### Entry Points

- Lambda handlers for each operation:
  - `getSettings/handler.ts`
  - `createSettings/handler.ts`
  - `deleteSettings/handler.ts`

## Usage

### As a Shared Resource

The `UdpHttpClient` is designed as a shared resource that can be reused across multiple use cases:

```typescript
import { UdpHttpClient, ClientCredentialsProvider } from '@modules/udp';

const authProvider = new ClientCredentialsProvider({
  tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT,
  clientId: process.env.UDP_CLIENT_ID,
  clientSecret: process.env.UDP_CLIENT_SECRET,
  scope: 'udp:read udp:write',
});

const udpClient = new UdpHttpClient({
  baseUrl: process.env.UDP_BASE_URL,
  authTokenProvider: authProvider,
});

// Use the client
const userData = await udpClient.getUserData('user-123');
```

### Using Use Cases

```typescript
import {
  GetSettingsUseCase,
  UdpHttpClient,
  ClientCredentialsProvider,
} from '@modules/udp';

const useCase = new GetSettingsUseCase(udpClient);
const result = await useCase.execute('user-123');
```

### Lambda Handlers

Each handler can be deployed as a separate Lambda function:

```typescript
import { getSettingsHandler } from '@modules/udp';

// In your Lambda configuration
export const handler = getSettingsHandler;
```

## Environment Variables

Required environment variables for Lambda handlers:

- `UDP_TOKEN_ENDPOINT` - OAuth2 token endpoint URL
- `UDP_CLIENT_ID` - OAuth2 client ID
- `UDP_CLIENT_SECRET` - OAuth2 client secret
- `UDP_SCOPE` - OAuth2 scope (e.g., "udp:read udp:write")
- `UDP_BASE_URL` - Base URL for the UDP API

## Testing

All components follow Test-Driven Development (TDD):

```bash
# Run tests
nx test @modules/udp

# Run tests with coverage
nx test @modules/udp --coverage
```

## Design Decisions

1. **Shared UDP Client**: The `UdpHttpClient` is a shared resource that implements the `UserDataPlatformPort`, making it reusable across different use cases and Lambda functions.

2. **Token Caching**: The `ClientCredentialsProvider` automatically caches access tokens and refreshes them when expired, reducing unnecessary API calls.

3. **Hexagonal Architecture**: The module separates domain logic from infrastructure concerns, making it easier to test and maintain.

4. **TDD Approach**: All components were developed using Test-Driven Development, ensuring comprehensive test coverage.
