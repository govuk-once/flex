export interface MacieCustomIdentifier {
  readonly name: string;
  readonly regex: string;
  readonly description: string;
}

export interface MacieCoverageConfig {
  readonly coveredDomains: readonly string[];
  readonly customDataIdentifiers: readonly MacieCustomIdentifier[];
}

export const macieCoverage: MacieCoverageConfig = {
  coveredDomains: ["dvla", "example", "local-council", "udp", "uns"],
  customDataIdentifiers: [],
};
