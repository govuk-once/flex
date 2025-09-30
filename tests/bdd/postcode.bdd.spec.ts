import { describe, it, expect } from 'vitest';
import { PostcodeLookupService } from '../../src/modules/postcode/application/PostcodeLookupService';
import { InMemoryPostcodeLookupRepository } from '../../src/modules/postcode/infrastructure/InMemoryPostcodeLookupRepository';

function Given<T>(name: string, fn: () => T): T { return fn(); }
async function When<T>(name: string, fn: () => Promise<T> | T): Promise<T> { return await fn(); }
function Then(name: string, fn: () => void) { fn(); }

describe('BDD: Postcode Lookup', () => {
	it('Lookup addresses for a valid postcode', async () => {
		const context = Given('a postcode', () => ({ postcode: 'SW1A 1AA' }));
		const service = new PostcodeLookupService(new InMemoryPostcodeLookupRepository());
		const result = await When('I request address lookup', async () => service.lookup({ postcode: context.postcode }));
		Then('I receive at least 1 address', () => {
			expect(result.addresses.length).toBeGreaterThanOrEqual(1);
		});
	});

	it('Reject invalid postcode', async () => {
		const context = Given('an invalid postcode', () => ({ postcode: 'INVALID' }));
		const service = new PostcodeLookupService(new InMemoryPostcodeLookupRepository());
		await expect(When('I request address lookup', async () => service.lookup({ postcode: context.postcode }))).rejects.toThrowError();
	});
});
