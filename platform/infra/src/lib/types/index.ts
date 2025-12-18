// TODO: Move to shared types package
export type Autocomplete<T extends string> = T | (string & {});

export type Environment = Autocomplete<'dev'>;

export type ResourceTagEnvironment =
  | 'development'
  | 'integration'
  | 'staging'
  | 'production';

// https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html
export interface ResourceTagOptions {
  readonly Product: string;
  readonly System: string;
  readonly Environment: ResourceTagEnvironment;
  readonly Owner: string;
  readonly Service?: string;
  readonly Source?: string;
  readonly Exposure?: string;
  readonly DataClassification?: string;
  readonly CostCentre?: string;
}

// TODO: What do we want to include here?
export interface EnvironmentConfig {
  readonly environment: Environment;
  readonly environmentTag: ResourceTagEnvironment;
  readonly stackName: string;
}
