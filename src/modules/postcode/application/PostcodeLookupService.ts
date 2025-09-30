import { Postcode } from '../domain/Postcode';
import { PostcodeLookupRequestDTO, PostcodeLookupResponseDTO } from './dto/PostcodeLookupDTO';
import { PostcodeLookupRepository } from './ports/PostcodeLookupRepository';

export class PostcodeLookupService {
	private readonly repository: PostcodeLookupRepository;

	constructor(repository: PostcodeLookupRepository) {
		this.repository = repository;
	}

	public async lookup(request: PostcodeLookupRequestDTO): Promise<PostcodeLookupResponseDTO> {
		const postcode = Postcode.create(request.postcode);
		const addresses = await this.repository.findByPostcode(postcode);
		return {
			addresses: addresses.map(a => ({
				building: a.buildingNameOrNumber,
				street: a.thoroughfare,
				locality: a.locality,
				city: a.townOrCity,
				county: a.county,
				postcode: a.postcode,
			}))
		};
	}
}
