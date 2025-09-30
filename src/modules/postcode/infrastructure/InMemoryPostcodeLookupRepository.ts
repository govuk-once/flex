import { PostcodeLookupRepository } from '../application/ports/PostcodeLookupRepository';
import { Address } from '../domain/Address';
import { Postcode } from '../domain/Postcode';

const SAMPLE_DATA: Record<string, Address[]> = {
	SW1A1AA: [
		{
			buildingNameOrNumber: '10',
			thoroughfare: 'Downing Street',
			locality: undefined,
			townOrCity: 'London',
			county: undefined,
			postcode: 'SW1A1AA'
		}
	]
};

export class InMemoryPostcodeLookupRepository implements PostcodeLookupRepository {
	async findByPostcode(postcode: Postcode): Promise<readonly Address[]> {
		return SAMPLE_DATA[postcode.toString()] ?? [];
	}
}
