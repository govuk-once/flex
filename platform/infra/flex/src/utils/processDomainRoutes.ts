import { IDomainEndpoint, IDomainRoutes, IPermission } from "@flex/sdk";
import {
  FlexKmsKeyAlias,
  FlexParam,
  FlexSecret,
  importFlexKmsKeyAlias,
  importFlexParameter,
  importFlexSecret,
} from "@platform/core/outputs";
import { Duration } from "aws-cdk-lib";
import { IResource } from "aws-cdk-lib/aws-apigateway";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { grantPrivateApiAccess } from "../service-gateway/private-gateway-permissions";
import { getDomainEntry } from "./getEntry";

export interface ProcessDomainRoutesConfig {
  domain: string;
  versionedRoutes: IDomainRoutes;
  domainsResource: IResource;
  createApiRoute: (
    domain: string,
    version: string,
    path: string,
    method: HttpMethod,
    handler: NodejsFunction,
  ) => void;
}

/**
 * Shared logic for processing domain routes: creates Lambdas, API routes, and IAM permissions.
 * Used by both FlexDomainStack (HttpApi) and PrivateDomainFactory (RestApi) so resources
 * are created in the correct scope and no nested-stack cyclic dependency occurs.
 */
export function processDomainRoutes(
  scope: Construct,
  config: ProcessDomainRoutesConfig,
): void {
  const envCache = new Map<string, ISecret | IStringParameter>();
  const keyCache = new Map<string, IKey>();

  function getOrImportEnv(
    path: string,
    isSecret: boolean,
  ): ISecret | IStringParameter {
    const cached = envCache.get(path);
    if (cached !== undefined) return cached;

    const resource = isSecret
      ? importFlexSecret(scope, path as FlexSecret)
      : importFlexParameter(scope, path as FlexParam);

    envCache.set(path, resource);
    return resource;
  }

  function getOrImportKey(aliasPath: string): IKey {
    const cached = keyCache.get(aliasPath);
    if (cached !== undefined) return cached;

    const key = importFlexKmsKeyAlias(scope, aliasPath as FlexKmsKeyAlias);
    keyCache.set(aliasPath, key);
    return key;
  }

  function resolveEnvironment(
    env?: Record<string, string>,
    envSecret?: Record<string, string>,
  ) {
    const resolvedVars: Record<string, string> = {};
    const envGrantables: (ISecret | IStringParameter)[] = [];

    const processMap = (
      map: Record<string, string> | undefined,
      isSecret: boolean,
    ) => {
      if (!map) return;
      Object.entries(map).forEach(([envKey, resourcePath]) => {
        const resource = getOrImportEnv(resourcePath, isSecret);
        envGrantables.push(resource);
        resolvedVars[envKey] = isSecret
          ? (resource as ISecret).secretName
          : (resource as IStringParameter).parameterName;
      });
    };

    processMap(env, false);
    processMap(envSecret, true);

    return { resolvedVars, envGrantables };
  }

  function resolveKms(keys?: Record<string, string>) {
    const kmsVars: Record<string, string> = {};
    const kmsGrantables: IKey[] = [];

    if (!keys) return { kmsVars, kmsGrantables };

    Object.entries(keys).forEach(([envKey, keyAlias]) => {
      const key = getOrImportKey(keyAlias);
      kmsGrantables.push(key);
      kmsVars[envKey] = key.keyArn;
    });

    return { kmsVars, kmsGrantables };
  }

  function createFunction(
    route: IDomainEndpoint,
    domain: string,
    path: string,
    method: HttpMethod,
    versionId: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type, timeoutSeconds } = route;
    const cleanPath = path.replace(/\//g, "-");
    const id = `${versionId}${cleanPath}-${method}`;

    const props = {
      domain,
      entry: getDomainEntry(domain, entry),
      environment,
      timeout: timeoutSeconds ? Duration.seconds(timeoutSeconds) : undefined,
    };

    switch (type) {
      case "PUBLIC":
        return new FlexPublicFunction(scope, id, props);
      case "PRIVATE":
        return new FlexPrivateEgressFunction(scope, id, props);
      case "ISOLATED":
        return new FlexPrivateIsolatedFunction(scope, id, props);
    }
  }

  function grantPermissions(
    role: IRole | undefined,
    permissions: IPermission[],
    domain: string,
  ): void {
    if (!role) return;
    const routePrefixes: string[] = [];
    const methods: string[] = [];

    for (const perm of permissions) {
      let base = "";
      if (perm.type === "domain") {
        const targetDomainId = perm.targetDomainId ?? domain;
        base = `/domains/${targetDomainId}`;
      } else {
        base = `/gateways/${domain}`;
      }

      const suffix = perm.path.startsWith("/") ? perm.path : `/${perm.path}`;
      routePrefixes.push(`${base}${suffix}`);

      if (perm.method && !methods.includes(perm.method)) {
        methods.push(perm.method);
      }
    }

    if (routePrefixes.length > 0) {
      grantPrivateApiAccess(role, config.domainsResource, {
        domainId: domain,
        allowedRoutePrefixes: routePrefixes,
        allowedMethods: methods.length > 0 ? methods : undefined,
      });
    }
  }

  const { domain, versionedRoutes, createApiRoute } = config;

  for (const [versionId, versionConfig] of Object.entries(
    versionedRoutes.versions,
  )) {
    for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
      for (const [methodKey, routeConfig] of Object.entries(methodMap)) {
        const method = methodKey as HttpMethod;

        const { resolvedVars, envGrantables } = resolveEnvironment(
          routeConfig.env,
          routeConfig.envSecret,
        );

        const { kmsGrantables } = resolveKms(routeConfig.kmsKeys);

        const domainEndpointFn = createFunction(
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

        createApiRoute(
          domain,
          versionId,
          path,
          method,
          domainEndpointFn.function,
        );

        if (routeConfig.permissions && routeConfig.permissions.length > 0) {
          grantPermissions(
            domainEndpointFn.function.role,
            routeConfig.permissions,
            domain,
          );
        }
      }
    }
  }
}
