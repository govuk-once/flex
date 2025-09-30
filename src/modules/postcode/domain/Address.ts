export interface Address {
	buildingNameOrNumber: string;
	thoroughfare: string;
	locality?: string;
	townOrCity: string;
	county?: string;
	postcode: string;
}
