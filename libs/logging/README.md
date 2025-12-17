# @flex/logging

This package provides a simple, cached logger utility for use across the FLEX project, built on top of [AWS Lambda Powertools Logger](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/).

## Features

- Singleton logger instance per runtime (cached)
- Type-safe logger options
- Child logger creation for contextual logging
- Simple API for consistent logging across services

## Usage

### Installation

Install the package and its peer dependency:

```bash
pnpm add @flex/logging @aws-lambda-powertools/logger
# or
npm install @flex/logging @aws-lambda-powertools/logger
```

### Basic Example

```typescript
import { getLogger, getChildLogger } from '@flex/logging';

// Initialize the logger (once per runtime)
const logger = getLogger({ logLevel: 'INFO', serviceName: 'my-service' });

// Use the logger
logger.info('Hello from my-service!');

// Create a child logger for additional context
const childLogger = getChildLogger({ requestId: 'abc-123' });
childLogger.debug('This is a child logger');
```

### API

#### `getLogger(options?: LoggerOptions): Logger`

- Returns a cached logger instance. Throws if called without options before initialization.
- `LoggerOptions`:
  - `logLevel` (optional): Log level (e.g., 'INFO', 'DEBUG'). Defaults to 'INFO'.
  - `serviceName` (required): Name of the service for log context.

#### `getChildLogger(context: Record<string, unknown>): Logger`

- Returns a child logger with additional context. Throws if logger is not initialized.

## Testing & Linting

```bash
npx nx test logging
npx nx lint logging
```
