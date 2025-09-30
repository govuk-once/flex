export interface PostcodeLookupRequestDTO {
	postcode: string;
}

export interface AddressDTO {
	building: string;
	street: string;
	locality?: string;
	city: string;
	county?: string;
	postcode: string;
}

export interface PostcodeLookupResponseDTO {
	addresses: AddressDTO[];
}
