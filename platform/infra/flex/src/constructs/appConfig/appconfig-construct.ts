import { IFeatureFlags } from "@flex/sdk";
import * as appconfig from "aws-cdk-lib/aws-appconfig";
import { Construct } from "constructs";

export type AppConfigFeatureFlags = {
  version: string;
  flags: Record<
    string,
    {
      name: string;
      description?: string;
      attributes?: Record<string, unknown>;
    }
  >;
  values: Record<
    string,
    {
      enabled: boolean;
      [key: string]: unknown;
    }
  >;
};

function transformFeatureFlags(
  featureFlags: IFeatureFlags,
): AppConfigFeatureFlags {
  const [flags, values] = Object.entries(featureFlags).reduce(
    ([flagsAcc, valuesAcc], [key, flag]) => {
      flagsAcc[key] = {
        name: flag.name,
        description: flag.description,
      };
      valuesAcc[key] = { enabled: flag.enabled };
      return [flagsAcc, valuesAcc];
    },
    [
      {} as Record<string, { name: string; description?: string }>,
      {} as Record<string, { enabled: boolean }>,
    ],
  );

  return {
    version: "1",
    flags,
    values,
  };
}

export interface AppConfigConstructProps {
  readonly developerId?: string;
  readonly environment: string;
  readonly applicationName: string;
  readonly configurationProfileName?: string;
  readonly deploymentStrategyName?: string;
  readonly featureFlags: IFeatureFlags;
}

export class AppConfigConstruct extends Construct {
  public readonly application: appconfig.CfnApplication;
  public readonly environment: appconfig.CfnEnvironment;
  public readonly configurationProfile: appconfig.CfnConfigurationProfile;
  public readonly hostedConfigurationVersion: appconfig.CfnHostedConfigurationVersion;
  public readonly deploymentStrategy: appconfig.CfnDeploymentStrategy;
  public readonly deployment: appconfig.CfnDeployment;

  constructor(scope: Construct, id: string, props: AppConfigConstructProps) {
    super(scope, id);

    const {
      developerId,
      environment,
      applicationName,
      configurationProfileName = "feature-flags",
      deploymentStrategyName = "feature-flag-all-at-once",
      featureFlags,
    } = props;

    const transformedFeatureFlags = transformFeatureFlags(featureFlags);

    const appName = developerId
      ? `${developerId}-${applicationName}`
      : applicationName;

    this.application = new appconfig.CfnApplication(this, "Application", {
      name: appName,
      description: `AppConfig application for ${applicationName}`,
    });

    this.environment = new appconfig.CfnEnvironment(this, "Environment", {
      applicationId: this.application.ref,
      name: environment,
      description: `AppConfig environment for ${environment}`,
    });

    this.configurationProfile = new appconfig.CfnConfigurationProfile(
      this,
      "FeatureFlagsProfile",
      {
        applicationId: this.application.ref,
        locationUri: "hosted",
        name: configurationProfileName,
        type: "AWS.AppConfig.FeatureFlags",
      },
    );

    this.hostedConfigurationVersion =
      new appconfig.CfnHostedConfigurationVersion(this, "FeatureFlagsVersion", {
        applicationId: this.application.ref,
        configurationProfileId: this.configurationProfile.ref,
        content: JSON.stringify(transformedFeatureFlags, null, 2),
        contentType: "application/json",
        description: `Feature flags for ${environment}`,
      });

    this.deploymentStrategy = new appconfig.CfnDeploymentStrategy(
      this,
      "DeploymentStrategy",
      {
        name: developerId
          ? `${developerId}-${deploymentStrategyName}`
          : deploymentStrategyName,
        description: "Immediate feature flag rollout",
        deploymentDurationInMinutes: 1,
        growthFactor: 100,
        growthType: "LINEAR",
        finalBakeTimeInMinutes: 1,
        replicateTo: "NONE",
      },
    );

    this.deployment = new appconfig.CfnDeployment(this, "Deployment", {
      applicationId: this.application.ref,
      configurationProfileId: this.configurationProfile.ref,
      configurationVersion: this.hostedConfigurationVersion.ref,
      deploymentStrategyId: this.deploymentStrategy.ref,
      environmentId: this.environment.ref,
      description: `Deploy feature flags to ${environment}`,
    });

    this.deployment.addDependency(this.hostedConfigurationVersion);
  }
}
