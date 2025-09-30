import { Address } from '../../domain/Address';
import { Postcode } from '../../domain/Postcode';

export interface PostcodeLookupRepository {
	findByPostcode(postcode: Postcode): Promise<readonly Address[]>;
}
