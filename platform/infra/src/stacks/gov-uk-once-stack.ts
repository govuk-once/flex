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
  env: {
    account?: string;
    region: "eu-west-2" | "eu-west-1";
  };
  tags: TagOptions;
}

enum Environment {
  DEVELOPMENT = "development",
  INTEGRATION = "integration",
  STAGING = "staging",
  PRODUCTION = "production",
}

function sanitizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 12);
}

function getUser() {
  const user = process.env.USER;
  if (!user) return null;

  return sanitizeUsername(user);
}

function getEnvironment() {
  const env = process.env.ENVIRONMENT;
  if (!env) return null;

  const envs = Object.values(Environment);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (envs.some((e) => e === env)) return env as Environment;
  throw new Error(
    `ENVIRONMENT env var not recognised. Value: ${env}, Values: ${envs.join(", ")}`,
  );
}

/**
 * Returns the environment config for this deployment.
 */
export function getEnvConfig() {
  const environment = getEnvironment();
  const user = getUser();
  const stage = environment ?? user;

  if (!stage) {
    throw new Error("ENVIRONMENT or USER env var not set");
  }

  return {
    environment: environment ?? Environment.DEVELOPMENT,
    stage,
    persistent: environment !== null,
  };
}

export function generateParamName(name: string) {
  const { environment } = getEnvConfig();
  return `/${environment}/flex${name}`;
}

/**
 * Returns the common stack name prefixed with the stage
 */
export function getStackName(stack: string): string {
  const { stage } = getEnvConfig();
  return `${stage}-${stack}`;
}

export function getAwsAccount() {
  return process.env.CDK_DEFAULT_ACCOUNT;
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
    { env, tags }: GovUkOnceStackProps,
  ) {
    super(scope, id, { env });
    this.addStackTags(tags);
  }
}
