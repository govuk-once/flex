import { describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '@aws-lambda-powertools/logger';

describe('logging', () => {
  let getLogger: typeof import('./logging').getLogger;
  let getChildLogger: typeof import('./logging').getChildLogger;

  beforeEach(async () => {
    const loggerModule = await import('./logging');
    getLogger = loggerModule.getLogger;
    getChildLogger = loggerModule.getChildLogger;
  });

  it('throws when getLogger is called without options before initialization', () => {
    expect(() => getLogger()).toThrow(
      'Logger instance not initialized. Call getLogger with options first.',
    );
  });

  it('returns the same logger instance when created with options', () => {
    const logger = getLogger({ logLevel: 'INFO', serviceName: 'test-service' });
    expect(logger).toBeInstanceOf(Logger);
    expect(getLogger()).toBe(logger);
  });

  it('creates a child logger from the cached logger', () => {
    const logger = getLogger({ logLevel: 'INFO', serviceName: 'test-service' });
    const child = getChildLogger({ foo: 'bar' });
    expect(child).toBeInstanceOf(Logger);
    expect(child).not.toBe(logger);
  });

  it.only('throws when getChildLogger is called before logger is initialized', async () => {
    expect(() => getChildLogger({ foo: 'bar' })).toThrow(
      'Logger instance not initialized. Call getLogger first.',
    );
  });
});
