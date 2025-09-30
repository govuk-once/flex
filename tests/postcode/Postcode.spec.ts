import { describe, it, expect } from 'vitest';
import { Postcode } from '../../src/modules/postcode/domain/Postcode';

describe('Postcode', () => {
	it('normalises and validates a valid postcode', () => {
		const pc = Postcode.create(' sw1a 1aa ');
		expect(pc.toString()).toBe('SW1A1AA');
	});

	it('throws for invalid postcode', () => {
		expect(() => Postcode.create('INVALID')).toThrowError();
	});
});
