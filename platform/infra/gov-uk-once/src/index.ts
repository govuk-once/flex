import { sanitiseStageName } from "@flex/utils";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";

// https://gds-way.digital.cabinet-office.gov.uk/manuals/aws-tagging.html
interface TagOptions {
  readonly Product: string;
  readonly System: string;
  readonly Owner: string;
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
    region?: "eu-west-2" | "eu-west-1";
  };
  tags: TagOptions;
}

enum Environment {
  DEVELOPMENT = "development",
  INTEGRATION = "integration",
  STAGING = "staging",
  PRODUCTION = "production",
}

function getEnvironment(): Environment | string | null {
  const env = process.env.STAGE;
  if (!env) return null;

  // Check strict Enum matches (Development, Production, etc.)
  const envs = Object.values(Environment) as string[];
  if (envs.includes(env)) return env as Environment;

  // Check for PR pattern (e.g. "pr-123")
  const prRegex = /^pr-\d+$/;
  if (prRegex.test(env)) return env;

  throw new Error(
    `ENVIRONMENT env var not recognised. Value: "${env}". Expected standard Environment or 'pr-{number}' pattern.`,
  );
}

/**
 * Returns the environment config for this deployment.
 */
export function getEnvConfig() {
  const stage = sanitiseStageName(process.env.STAGE ?? process.env.USER);

  if (!stage) {
    throw new Error("STAGE or USER env var not set");
  }

  // Returns true if stage exists in Environment, false otherwise
  const persistent = (Object.values(Environment) as string[]).includes(stage);

  return {
    environment: persistent ? stage : Environment.DEVELOPMENT,
    stage,
    persistent: true,
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
  public getResourceName = (component: string) => {
    const { stackName } = cdk.Stack.of(this);
    return `${stackName}-${component}`; // Stack name should include stage
  };

  private addStackTags = (tags: TagOptions) => {
    // For developer stages we default to development environment
    const env = getEnvironment() ?? Environment.DEVELOPMENT;
    cdk.Tags.of(this).add("Environment", env);

    Object.entries(tags).forEach(([k, v]) => {
      if (typeof v === "string") {
        cdk.Tags.of(this).add(k, v, { priority: 100 });
      }
    });
  };

  protected constructor(
    scope: Construct,
    id: string,
    { env = {}, tags }: GovUkOnceStackProps,
  ) {
    super(scope, id, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: env.region ?? process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
      },
    });
    this.addStackTags(tags);
  }
}
