import { IDomain, IDomainEndpoint, Permission } from "@flex/sdk";
import { Duration } from "aws-cdk-lib";
import type { IResource, IRestApi } from "aws-cdk-lib/aws-apigateway";
import {
  IdentitySource,
  LambdaIntegration,
  Resource,
  RestApi,
  TokenAuthorizer,
} from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IKey, Key } from "aws-cdk-lib/aws-kms";
import { Function } from "aws-cdk-lib/aws-lambda";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { createHash } from "../utils/create-hash";
import { getDomainEntry } from "../utils/getEntry";
import { getParamName, getStageParamName } from "../utils/getParamName";
import { grantPrivateApiAccess } from "../utils/grantPrivateApiAccess";

export interface RouteBinding {
  method: string;
  path: string;
}

interface FlexDomainStackProps {
  publicDomain: IDomain;
  privateDomain?: IDomain;
}

type EnvResourceType = "core-param" | "ephemeral-param" | "secret";

export class FlexLegacyDomainStack extends BaseStack {
  public readonly publicRouteBindings: RouteBinding[] = [];
  public readonly privateRouteBindings: RouteBinding[] = [];

  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();

  #getRestApi(
    id: string,
    restApiId: string,
    rootResourceId: string,
    rootPath: string,
  ) {
    const restApi = RestApi.fromRestApiAttributes(this, `${id}Api`, {
      restApiId,
      rootResourceId,
    });

    const rootResource = Resource.fromResourceAttributes(this, `${id}Root`, {
      resourceId: rootResourceId,
      path: rootPath,
      restApi,
    });

    return {
      restApi,
      rootResource,
    };
  }

  #getPublicRestApi() {
    const restApiId = this.import(STAGE_KEYS.ApigwPublicRestId);
    const appResourceId = this.import(STAGE_KEYS.ApigwPublicAppRoot);
    return this.#getRestApi("Public", restApiId, appResourceId, "/app");
  }

  #getPrivateRestApi() {
    const restApiId = this.import(STAGE_KEYS.ApigwPrivateRestId);
    const resourceId = this.import(STAGE_KEYS.ApigwPrivateDomainRoot);
    return this.#getRestApi("Private", restApiId, resourceId, "/domains");
  }

  constructor(scope: Construct, id: string, props: FlexDomainStackProps) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: props.publicDomain.owner ?? "N/A",
        ResourceOwner: props.publicDomain.domain,
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    const publicRestApi = this.#getPublicRestApi();
    const privateRestApi = this.#getPrivateRestApi();

    this.#processPublicRoutes(props.publicDomain, publicRestApi.rootResource);

    if (props.privateDomain) {
      this.#processPrivateRoutes(
        props.privateDomain,
        privateRestApi.rootResource,
        props.publicDomain.domain,
        "internal-",
        privateRestApi.restApi,
      );
    }
  }

  #processPublicRoutes(domainConfig: IDomain, apiRoot: IResource): void {
    const authorizerFnArn = this.import(STAGE_KEYS.ApigwPublicAuthorizerFn);

    const authorizerFn = Function.fromFunctionAttributes(this, "AuthorizerFn", {
      functionArn: authorizerFnArn,
      sameEnvironment: true,
    });

    const authorizer = new TokenAuthorizer(this, "LambdaAuthorizer", {
      handler: authorizerFn,
      identitySource: IdentitySource.header("Authorization"),
    });

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

          const newPath = `${domainConfig.domain}/${versionId}${path}`
            .replace(/\/+/g, "/")
            .replace(/^\//, "");

          this.#addDeepResource(apiRoot, newPath).addMethod(
            method,
            new LambdaIntegration(domainEndpointFn.function),
            { authorizer },
          );

          this.publicRouteBindings.push({ method, path: newPath });
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

          this.privateRouteBindings.push({ method, path: newPath });

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

    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateEgressSg = this.importSecurityGroup(ENV_KEYS.SgPrivateEgress);
    const privateIsolatedSg = this.importSecurityGroup(
      ENV_KEYS.SgPrivateIsolated,
    );

    switch (type) {
      case "PUBLIC":
        return new FlexPublicFunction(this, id, props);
      case "PRIVATE":
        return new FlexPrivateEgressFunction(this, id, {
          vpc,
          privateEgressSg,
          ...props,
        });
      case "ISOLATED":
        return new FlexPrivateIsolatedFunction(this, id, {
          vpc,
          privateIsolatedSg,
          ...props,
        });
    }
  }

  #importFlexSecret(scope: Construct, secret: string) {
    return Secret.fromSecretNameV2(
      scope,
      `FlexSecret${createHash(secret)}`,
      getParamName(secret),
    );
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
      resource = this.#importFlexSecret(this, path);
    } else if (type === "ephemeral-param") {
      resource = StringParameter.fromStringParameterName(
        this,
        `EphemeralParam${createHash(path)}`,
        getStageParamName(path),
      );
    } else {
      resource = StringParameter.fromStringParameterName(
        this,
        `FlexParam${createHash(path)}`,
        getParamName(path),
      );
    }

    this.#envCache.set(cacheKey, resource);
    return resource;
  }

  #getOrImportKey(aliasPath: string): IKey {
    const cached = this.#keyCache.get(aliasPath);
    if (cached !== undefined) return cached;

    const key = Key.fromLookup(
      this,
      `FlexKmsKeyAlias${createHash(aliasPath)}`,
      {
        aliasName: `alias${getParamName(aliasPath)}`,
      },
    );

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
