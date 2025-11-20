import { describe, it, expect } from 'vitest';
import { handler } from './index';
import { response, Event } from './types';

describe('Test lambda handler', () => {
  it('Lambda returns 200', async () => {
    // Arrange
    const event: Event = {
      example: 'Example event',
    };

    const expectedResponse: response = {
      statusCode: 200,
    };

    // Act
    const result = await handler(event);

    // Assert
    expect(result).toEqual(expectedResponse);
  });
});
