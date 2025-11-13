import { describe, it, expect } from 'vitest';
import { handler } from './example';

describe('Lambda handle', () => {
  it('Test happy path', async () => {
    // Arrange
    const event = {};

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toEqual(200);
  });
});
