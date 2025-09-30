export class Postcode {
	private readonly value: string;

	private constructor(value: string) {
		this.value = value;
	}

	public static create(raw: string): Postcode {
		const normalised = Postcode.normalise(raw);
		if (!Postcode.isValid(normalised)) {
			throw new Error(`Invalid postcode: ${raw}`);
		}
		return new Postcode(normalised);
	}

	public toString(): string {
		return this.value;
	}

	private static normalise(input: string): string {
		if (!input) return "";
		return input.trim().toUpperCase().replace(/\s+/g, "");
	}

	private static isValid(input: string): boolean {
		// Simplified UK postcode regex (no BFPO/territories), compacted (no spaces)
		// Reference pattern transformed to nospace variant
		const pattern = /^(GIR0AA|[A-PR-UWYZ][0-9][0-9]?[0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9A-HJKPSTUW]?)[0-9][ABD-HJLNP-UW-Z]{2}$/;
		return pattern.test(input);
	}
}
