// https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html
export interface TagOptions {
  readonly Product: string;
  readonly System: string;
  readonly Owner: string;
  readonly ResourceOwner: string;
  readonly Service?: string;
  readonly Source?: string;
  readonly Exposure?: string;
  readonly DataClassification?: string;
  readonly CostCentre?: string;
  // readonly Stage: string; Added automatically
  // readonly Environment: string; Added automatically
}

export interface BaseStackProps {
  env: {
    region: "eu-west-2" | "us-east-1";
  };
  tags: TagOptions;
}
