import { IDomain, IDomainEndpoint } from "@flex/sdk";
import {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import { getEnvConfig } from "@platform/gov-uk-once";
import {
  HttpApi,
  HttpMethod,
  HttpRoute,
  HttpRouteKey,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { IKey } from "aws-cdk-lib/aws-kms";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { AppConfigConstruct } from "./appConfig/appconfig-construct";
import { FlexPrivateEgressFunction } from "./lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "./lambda/flex-public-function";

export class DomainFactory extends Construct {
  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();

  constructor(
    scope: Construct,
    id: string,
    domainConfig: IDomain,
    httpApi: HttpApi,
  ) {
    super(scope, id);
    const { versions, domain, featureFlags } = domainConfig;

    const { environment } = getEnvConfig();

    const environmentFeatureFlags =
      featureFlags?.[environment] ?? featureFlags?.default ?? {};

    const appConfig = new AppConfigConstruct(this, `${domain}AppConfig`, {
      environment,
      applicationName: `${domain}-appconfig`,
      featureFlags: environmentFeatureFlags,
    });

    for (const [versionId, versionConfig] of Object.entries(versions)) {
      for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
        for (const [methodKey, routeConfig] of Object.entries(methodMap)) {
          const method = methodKey as HttpMethod;

          const { resolvedVars, envGrantables } = this.#resolveEnvironment(
            routeConfig.env,
            routeConfig.envSecret,
            appConfig,
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

          this.#createApiRoute(
            httpApi,
            domain,
            versionId,
            path,
            method,
            domainEndpointFn.function,
          );
        }
      }
    }
  }

  /**
   * Resolves standard Env Vars and Secrets.
   * Returns a map of EnvKeys -> Values and a list of resources to grant permissions to.
   */
  #resolveEnvironment(
    env?: Record<string, string>,
    envSecret?: Record<string, string>,
    appConfig?: AppConfigConstruct,
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

    resolvedVars.APP_CONFIG_APPLICATION_ID = appConfig?.application.ref ?? "";
    resolvedVars.APP_CONFIG_CONFIGURATION_PROFILE_ID =
      appConfig?.configurationProfile.ref ?? "";
    resolvedVars.APP_CONFIG_ENVIRONMENT_ID = appConfig?.environment.ref ?? "";

    return { resolvedVars, envGrantables };
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
    method: HttpMethod,
    versionId: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type } = route;
    const cleanPath = path.replace(/\//g, "-");
    const id = `${versionId}${cleanPath}-${method}`;

    const props = {
      domain,
      entry: getEntry(domain, entry),
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

  /**
   * Creates the API Gateway Route integration
   */
  #createApiRoute(
    httpApi: HttpApi,
    domain: string,
    version: string,
    path: string,
    method: HttpMethod,
    handler: NodejsFunction,
  ) {
    const fullPath = `/app/${version}${path}`.replace(/\/\//g, "/");

    const cleanPathId = path.replace(/\//g, "");
    const integrationId = `${domain}-${version}-${method}-${cleanPathId}`;

    new HttpRoute(this, `Route-${integrationId}`, {
      httpApi: httpApi,
      routeKey: HttpRouteKey.with(fullPath, method),
      integration: new HttpLambdaIntegration(integrationId, handler),
    });
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
