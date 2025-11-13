import { describe, it, expect } from 'vitest';
import { IGreetings, Greetings } from './Greetings';

describe('Test Greetings class', () => {
  it('Test getGreetings', () => {
    // Arrange
    const greetings: IGreetings = new Greetings();

    // Act
    const result = greetings.getGreetings();

    // Assert
    expect(result).toEqual('hello from Greetings');
  });

  it('Test getGreetings - custom message', () => {
    // Arrange
    const greetings: IGreetings = new Greetings('hello world');

    // Act
    const result = greetings.getGreetings();

    // Assert
    expect(result).toEqual('hello world');
  });
});
