import type {
  FunctionConfig,
  IacDomainConfig,
  IDomain,
  IDomainEndpoint,
  Permission,
  RouteAccess,
} from "@flex/sdk";
import {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import { Duration } from "aws-cdk-lib";
import type { IResource, IRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  LambdaIntegration,
  Resource,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import type { IRole } from "aws-cdk-lib/aws-iam";
import type { IKey } from "aws-cdk-lib/aws-kms";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import type { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import crypto from "crypto";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { getDomainEntry } from "../utils/getEntry";
import { FlexEphemeralParam, getParamName } from "../utils/getParamName";
import { grantPrivateApiAccess } from "../utils/grantPrivateApiAccess";
import { grantRoutePermissions } from "../utils/integrations";
import { toFunctionConfig } from "../utils/lambda";
import {
  grantRouteResources,
  importResources,
  resolveApiResource,
} from "../utils/resources";
import {
  flattenRoutes,
  getFunctionAccess,
  resolveRouteReferences,
  toApiGatewayPath,
  toPascalCase,
} from "../utils/routes";
import type { PrivateApiRef } from "./private-gateway";

interface FlexDomainStackProps {
  domain: IDomain;
  privateDomain?: IDomain;
  privateApi: PrivateApiRef;
}

type EnvResourceType = "core-param" | "ephemeral-param" | "secret";

export class FlexDomainStack extends GovUkOnceStack {
  public readonly publicRouteBindings: PublicRouteBinding[] = [];
  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();

  constructor(scope: Construct, id: string, props: FlexDomainStackProps) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: props.domain.owner ?? "N/A",
        ResourceOwner: props.domain.domain,
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const privateApi = RestApi.fromRestApiAttributes(this, "PrivateApi", {
      restApiId: props.privateApi.restApiId,
      rootResourceId: props.privateApi.domainsRootResourceId,
    });

    const privateDomainsRoot = Resource.fromResourceAttributes(
      this,
      "PrivateDomainsRoot",
      {
        resourceId: props.privateApi.domainsRootResourceId,
        path: "/domains",
        restApi: privateApi,
      },
    );

    this.#processPublicRoutes(props.domain);

    if (props.privateDomain) {
      this.#processPrivateRoutes(
        props.privateDomain,
        privateDomainsRoot,
        props.domain.domain,
        "internal-",
        privateApi,
      );
    }
  }

  #processPublicRoutes(domainConfig: IDomain): void {
    for (const [versionId, versionConfig] of Object.entries(
      domainConfig.versions,
    )) {
      for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
        for (const [method, routeConfig] of Object.entries(methodMap)) {
          const { resolvedVars, envGrantables } = this.#resolveEnvironment(
            routeConfig.env,
            routeConfig.envEphemeral,
            routeConfig.envSecret,
          );

          const { kmsGrantables } = this.#resolveKms(routeConfig.kmsKeys);

          const domainEndpointFn = this.#createFunction(
            routeConfig,
            domainConfig.domain,
            path,
            method,
            versionId,
            "public-",
            resolvedVars,
          );

          envGrantables.forEach((resource) => {
            resource.grantRead(domainEndpointFn.function);
          });

          kmsGrantables.forEach((key) => {
            key.grantDecrypt(domainEndpointFn.function);
          });

          const newPath = `app/${versionId}${path}`
            .replace(/\/+/g, "/")
            .replace(/^\//, "");

          this.publicRouteBindings.push({
            path: newPath,
            method,
            handler: domainEndpointFn.function,
            // NOTE: Default to false, this field is used in PoC
            isPublicAccess: false,
          });
        }
      }
    }
  }

  #processPrivateRoutes(
    domainConfig: IDomain,
    apiRoot: IResource,
    pathPrefix: string,
    idPrefix: string,
    internalApiForPermissions?: IRestApi | RestApi,
  ): void {
    for (const [versionId, versionConfig] of Object.entries(
      domainConfig.versions,
    )) {
      for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
        for (const [method, routeConfig] of Object.entries(methodMap)) {
          const { resolvedVars, envGrantables } = this.#resolveEnvironment(
            routeConfig.env,
            routeConfig.envEphemeral,
            routeConfig.envSecret,
          );

          const { kmsGrantables } = this.#resolveKms(routeConfig.kmsKeys);

          const domainEndpointFn = this.#createFunction(
            routeConfig,
            domainConfig.domain,
            path,
            method,
            versionId,
            idPrefix,
            resolvedVars,
          );

          envGrantables.forEach((resource) => {
            resource.grantRead(domainEndpointFn.function);
          });

          kmsGrantables.forEach((key) => {
            key.grantDecrypt(domainEndpointFn.function);
          });

          const newPath = `${pathPrefix}/${versionId}${path}`
            .replace(/\/+/g, "/")
            .replace(/^\//, "");

          const resource = this.#addDeepResource(apiRoot, newPath).addMethod(
            method,
            new LambdaIntegration(domainEndpointFn.function),
          );

          applyCheckovSkip(
            resource,
            "CKV_AWS_59",
            "Private API - access restricted by VPC endpoint and resource policy",
          );

          if (
            routeConfig.permissions &&
            domainEndpointFn.function.role &&
            internalApiForPermissions
          ) {
            this.#grantInternalGatewayPermissions(
              domainEndpointFn.function.role,
              routeConfig.permissions,
              domainConfig.domain,
              internalApiForPermissions,
            );
          }
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
    envEphemeral?: Record<string, string>,
    envSecret?: Record<string, string>,
  ) {
    const resolvedVars: Record<string, string> = {};
    const envGrantables: (ISecret | IStringParameter)[] = [];

    const processMap = (
      map: Record<string, string> | undefined,
      type: EnvResourceType,
    ) => {
      if (!map) return;
      Object.entries(map).forEach(([envKey, resourcePath]) => {
        const resource = this.#getOrImportEnv(resourcePath, type);

        envGrantables.push(resource);

        if (type === "secret") {
          resolvedVars[envKey] = (resource as ISecret).secretName;
          return;
        }

        resolvedVars[envKey] = (resource as IStringParameter).parameterName;
      });
    };

    processMap(env, "core-param");
    processMap(envEphemeral, "ephemeral-param");
    processMap(envSecret, "secret");

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
    method: string,
    versionId: string,
    idPrefix: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type } = route;
    const cleanPath = path.replace(/\//g, "-");
    const id = `${idPrefix}${versionId}${cleanPath}-${method}`;

    const props = {
      domain,
      entry: getDomainEntry(domain, entry),
      environment,
      ...(route.timeoutSeconds
        ? { timeout: Duration.seconds(route.timeoutSeconds) }
        : {}),
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
  #getOrImportEnv(
    path: string,
    type: EnvResourceType,
  ): ISecret | IStringParameter {
    const cacheKey = `${type}:${path}`;

    if (this.#envCache.has(cacheKey)) {
      const cached = this.#envCache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    let resource: ISecret | IStringParameter;

    if (type === "secret") {
      resource = importFlexSecret(this, path as FlexSecret);
    } else if (type === "ephemeral-param") {
      resource = StringParameter.fromStringParameterName(
        this,
        `EphemeralParam${this.#hash(path)}`,
        getParamName(path as FlexEphemeralParam),
      );
    } else {
      resource = importFlexParameter(this, path as FlexParam);
    }

    this.#envCache.set(cacheKey, resource);
    return resource;
  }

  #hash(value: string): string {
    return crypto.createHash("md5").update(value).digest("hex").slice(0, 16);
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

  #grantInternalGatewayPermissions(
    role: IRole,
    permissions: Permission[],
    domainName: string,
    internalApi: IRestApi,
  ): void {
    const allowedRoutePrefixes = permissions.map((perm) => {
      const base =
        perm.type === "domain"
          ? `/domains/${domainName}`
          : `/gateways/${domainName}`;
      const suffix = perm.path.startsWith("/") ? perm.path : `/${perm.path}`;
      return `${base}${suffix}`;
    });

    const allowedMethods = permissions.map((perm) => perm.method);

    grantPrivateApiAccess(role, internalApi, {
      domainId: domainName,
      allowedRoutePrefixes,
      allowedMethods,
    });
  }
}

// ----------------------------------------------------------------------------
// PoC
// ----------------------------------------------------------------------------

export interface PublicRouteBinding {
  readonly handler: IFunction;
  readonly method: string;
  readonly path: string;
  readonly isPublicAccess: boolean;
}

interface FlexDomainStackPoCProps {
  config: IacDomainConfig;
  privateApi: PrivateApiRef;
}

export class FlexDomainStackPoC extends GovUkOnceStack {
  public readonly publicRouteBindings: PublicRouteBinding[] = [];

  constructor(
    scope: Construct,
    id: string,
    { config, privateApi }: FlexDomainStackPoCProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: config.owner ?? "N/A",
        ResourceOwner: config.name,
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const privateRestApi = RestApi.fromRestApiAttributes(this, "PrivateApi", {
      restApiId: privateApi.restApiId,
      rootResourceId: privateApi.domainsRootResourceId,
    });

    const privateDomainsRoot = Resource.fromResourceAttributes(
      this,
      "PrivateDomainsRoot",
      {
        path: "/domains",
        resourceId: privateApi.domainsRootResourceId,
        restApi: privateRestApi,
      },
    );

    const routes = flattenRoutes(config.routes);

    const [resourceReferences, integrationReferences] = resolveRouteReferences(
      routes,
      { resources: config.resources, integrations: config.integrations },
    );

    const resources = importResources(this, resourceReferences);

    routes.forEach(
      ({ gateway, handlerPath, method, path, routeConfig, version }) => {
        const functionId = toPascalCase(
          `${config.name}-${gateway}-${version}-${routeConfig.name}`,
        );
        const routeAccess = getFunctionAccess(
          routeConfig.access,
          config.common?.access,
        );

        const lambda = this.#createFunction(functionId, routeAccess, {
          domain: config.name,
          entry: getDomainEntry(config.name, handlerPath),
          ...toFunctionConfig(routeConfig.function, config.common?.function),
        });

        if (routeConfig.resources?.length) {
          grantRouteResources(lambda.function, {
            keys: routeConfig.resources,
            resources,
          });
        }

        if (routeConfig.integrations?.length) {
          grantRoutePermissions(lambda.function, {
            keys: routeConfig.integrations,
            integrations: integrationReferences,
            api: privateRestApi,
            domain: config.name,
          });
        }

        const resourcePath = toApiGatewayPath({
          domain: config.name,
          gateway,
          version,
          path,
        });

        if (gateway === "public") {
          this.publicRouteBindings.push({
            handler: lambda.function,
            method,
            path: resourcePath,
            isPublicAccess: routeAccess === "public",
          });
        }

        if (gateway === "private") {
          const resource = resolveApiResource(privateDomainsRoot, resourcePath);

          const resourceMethod = resource.addMethod(
            method,
            new LambdaIntegration(lambda.function),
          );

          applyCheckovSkip(
            resourceMethod,
            "CKV_AWS_59",
            "Private API - access restricted by VPC endpoint and resource policy",
          );
        }
      },
    );
  }

  #createFunction(
    id: string,
    access: RouteAccess,
    props: ReturnType<typeof toFunctionConfig> & {
      domain: string;
      entry: string;
    },
  ) {
    switch (access) {
      case "isolated":
        return new FlexPrivateIsolatedFunction(this, id, props);
      case "private":
        return new FlexPrivateEgressFunction(this, id, props);
      case "public":
        return new FlexPublicFunction(this, id, props);
    }
  }
}
