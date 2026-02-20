import { IDomain, IDomainEndpoint } from "@flex/sdk";
import {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import { getEnvConfig, GovUkOnceStack } from "@platform/gov-uk-once";
import {
  IResource,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { IKey } from "aws-cdk-lib/aws-kms";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { getDomainEntry } from "../utils/getEntry";

interface FlexDomainStackProps {
  domain: IDomain;
  restApi: RestApi;
}

function parseFeatureFlagsForEnvironment(
  featureFlags: IDomain["featureFlags"],
  environment: string,
) {
  if (!featureFlags) return {};
  return Object.entries(featureFlags).reduce<Record<string, boolean>>(
    (flags, [flag, config]) => {
      flags[flag] =
        typeof config.enabled === "boolean"
          ? config.enabled
          : config.enabled.includes(environment);
      return flags;
    },
    {},
  );
}

export class FlexDomainStack extends GovUkOnceStack {
  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();

  constructor(
    scope: Construct,
    id: string,
    {
      domain: { domain, owner, versions, featureFlags },
      restApi,
    }: FlexDomainStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: owner ?? "N/A",
        ResourceOwner: domain,
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const { environment } = getEnvConfig();

    const environmentFeatureFlags = parseFeatureFlagsForEnvironment(
      featureFlags,
      environment,
    );

    for (const [versionId, versionConfig] of Object.entries(versions)) {
      for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
        for (const [method, routeConfig] of Object.entries(methodMap)) {
          const { resolvedVars, envGrantables } = this.#resolveEnvironment(
            routeConfig.env,
            routeConfig.envSecret,
            environmentFeatureFlags,
          );

          const { kmsGrantables } = this.#resolveKms(routeConfig.kmsKeys);

          const domainEndpointFn = this.#createFunction(
            routeConfig,
            domain,
            path,
            method,
            versionId,
            resolvedVars,
          );

          envGrantables.forEach((resource) => {
            resource.grantRead(domainEndpointFn.function);
          });

          kmsGrantables.forEach((key) => {
            key.grantDecrypt(domainEndpointFn.function);
          });

          const newPath = `app/${versionId}${path}`;

          this.#addDeepResource(restApi.root, newPath).addMethod(
            method,
            new LambdaIntegration(domainEndpointFn.function),
          );
        }
      }
    }
  }

  #addDeepResource(root: IResource, path: string): IResource {
    const parts = path.split("/").filter(Boolean);
    let current = root;

    for (const part of parts) {
      const existing = current.node.tryFindChild(part) as IResource | undefined;
      if (existing) {
        current = existing;
      } else {
        current = current.addResource(part);
      }
    }

    return current;
  }

  /**
   * Resolves standard Env Vars and Secrets.
   * Returns a map of EnvKeys -> Values and a list of resources to grant permissions to.
   */
  #resolveEnvironment(
    env?: Record<string, string>,
    envSecret?: Record<string, string>,
    featureFlags: Record<string, boolean> = {},
  ) {
    const resolvedVars: Record<string, string> = {};
    const envGrantables: (ISecret | IStringParameter)[] = [];

    const processMap = (
      map: Record<string, string> | undefined,
      isSecret: boolean,
    ) => {
      if (!map) return;
      Object.entries(map).forEach(([envKey, resourcePath]) => {
        const resource = this.#getOrImportEnv(resourcePath, isSecret);

        envGrantables.push(resource);

        resolvedVars[envKey] = isSecret
          ? (resource as ISecret).secretName
          : (resource as IStringParameter).parameterName;
      });
    };

    processMap(env, false);
    processMap(envSecret, true);

    const featureFlagStrings = Object.entries(featureFlags).reduce<
      Record<string, string>
    >((flags, [flagKey, flagValue]) => {
      const normalisedFlagKey = `${flagKey
        .toUpperCase()
        .replace(/_+(?:FEATURE_FLAG)?$/g, "")}_FEATURE_FLAG`;
      flags[normalisedFlagKey] = flagValue.toString();
      return flags;
    }, {});

    return {
      resolvedVars: { ...resolvedVars, ...featureFlagStrings },
      envGrantables,
    };
  }

  /**
   * Resolves KMS Keys.
   * Injects Key ARN as env var and prepares keys for permission granting.
   */
  #resolveKms(keys?: Record<string, string>) {
    const kmsVars: Record<string, string> = {};
    const kmsGrantables: IKey[] = [];

    if (!keys) return { kmsVars, kmsGrantables };

    Object.entries(keys).forEach(([envKey, keyAlias]) => {
      const key = this.#getOrImportKey(keyAlias);

      kmsGrantables.push(key);
      kmsVars[envKey] = key.keyArn;
    });

    return { kmsVars, kmsGrantables };
  }

  /**
   * Factory method to instantiate the correct Lambda Construct based on type
   */
  #createFunction(
    route: IDomainEndpoint,
    domain: string,
    path: string,
    method: string,
    versionId: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type } = route;
    const cleanPath = path.replace(/\//g, "-");
    const id = `${versionId}${cleanPath}-${method}`;

    const props = {
      domain,
      entry: getDomainEntry(domain, entry),
      environment,
    };

    switch (type) {
      case "PUBLIC":
        return new FlexPublicFunction(this, id, props);
      case "PRIVATE":
        return new FlexPrivateEgressFunction(this, id, props);
      case "ISOLATED":
        return new FlexPrivateIsolatedFunction(this, id, props);
    }
  }

  // --- Resource Importers ---
  #getOrImportEnv(path: string, isSecret: boolean): ISecret | IStringParameter {
    if (this.#envCache.has(path)) {
      const cached = this.#envCache.get(path);
      if (cached !== undefined) return cached;
    }

    const resource = isSecret
      ? importFlexSecret(this, path as FlexSecret)
      : importFlexParameter(this, path as FlexParam);

    this.#envCache.set(path, resource);
    return resource;
  }

  #getOrImportKey(aliasPath: string): IKey {
    if (this.#keyCache.has(aliasPath)) {
      const cached = this.#keyCache.get(aliasPath);
      if (cached !== undefined) return cached;
    }

    const key = importFlexKmsKeyAlias(this, aliasPath as FlexKmsKeyAlias);

    this.#keyCache.set(aliasPath, key);
    return key;
  }
}
