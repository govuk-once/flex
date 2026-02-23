import { IDomain, IDomainEndpoint, Permission } from "@flex/sdk";
import {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import {
  IResource,
  IRestApi,
  LambdaIntegration,
  Resource,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import crypto from "crypto";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { getDomainEntry } from "../utils/getEntry";
import { FlexEphemeralParam, getParamName } from "../utils/getParamName";
import { grantPrivateApiAccess } from "../utils/grantPrivateApiAccess";
import { PrivateApiRef } from "./private-gateway";

export interface PublicRouteBinding {
  path: string;
  method: string;
  handler: IFunction;
}

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
