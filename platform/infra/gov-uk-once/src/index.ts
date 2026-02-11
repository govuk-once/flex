import { sanitiseStageName } from "@flex/utils";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";

// https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html
interface TagOptions {
  readonly Product: string;
  readonly System: string;
  readonly Owner: string;
  readonly ResourceOwner: string;
  readonly Service?: string;
  readonly Source?: string;
  readonly Exposure?: string;
  readonly DataClassification?: string;
  readonly CostCentre?: string;
  // readonly Environment: string; Added automatically
}

interface GovUkOnceStackProps {
  env?: {
    account?: string;
    region?: "eu-west-2" | "eu-west-1" | "us-east-1";
  };
  crossRegionReferences?: boolean;
  tags: TagOptions;
}

enum Environment {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
}

function isEnvironment(value?: string): value is Environment {
  if (!value) return false;
  return Object.values(Environment).includes(value as Environment);
}

/**
 * Returns the environment config for this deployment.
 */
export function getEnvConfig() {
  const stage = sanitiseStageName(process.env.STAGE ?? process.env.USER);

  if (!stage) {
    throw new Error("STAGE or USER env var not set");
  }

  const persistent = isEnvironment(stage);

  return {
    // For non persistent stages we default to development environment
    environment: persistent ? stage : Environment.DEVELOPMENT,
    stage,
    persistent,
  };
}

/**
 * Returns the common stack name prefixed with the stage
 */
export function getStackName(stack: string): string {
  const { stage } = getEnvConfig();
  return `${stage}-${stack}`;
}

export class GovUkOnceStack extends cdk.Stack {
  public readonly stage: string;

  private addStackTags = (tags: TagOptions, environment: Environment) => {
    cdk.Tags.of(this).add("Environment", environment, { priority: 100 });

    Object.entries(tags).forEach(([k, v]) => {
      if (typeof v === "string") {
        cdk.Tags.of(this).add(k, v, { priority: 100 });
      }
    });
  };

  protected constructor(
    scope: Construct,
    id: string,
    props: GovUkOnceStackProps,
  ) {
    const { env = {}, tags, crossRegionReferences } = props;

    super(scope, id, {
      crossRegionReferences,
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: env.region ?? process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
      },
    });

    const { environment, stage } = getEnvConfig();

    this.stage = stage;

    this.addStackTags(tags, environment);
  }
}
