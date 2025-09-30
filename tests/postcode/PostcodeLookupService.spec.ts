import { describe, it, expect } from 'vitest';
import { PostcodeLookupService } from '../../src/modules/postcode/application/PostcodeLookupService';
import { InMemoryPostcodeLookupRepository } from '../../src/modules/postcode/infrastructure/InMemoryPostcodeLookupRepository';

describe('PostcodeLookupService', () => {
	it('returns addresses for a valid postcode', async () => {
		const service = new PostcodeLookupService(new InMemoryPostcodeLookupRepository());
		const result = await service.lookup({ postcode: 'SW1A 1AA' });
		expect(result.addresses.length).toBeGreaterThanOrEqual(1);
		expect(result.addresses[0].postcode).toBe('SW1A1AA');
	});

	it('throws validation error for invalid postcode', async () => {
		const service = new PostcodeLookupService(new InMemoryPostcodeLookupRepository());
		await expect(service.lookup({ postcode: 'INVALID' })).rejects.toThrowError();
	});
});
