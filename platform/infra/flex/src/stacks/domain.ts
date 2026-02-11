import { IDomainEndpoint, IDomainRoutes, IPermission } from "@flex/sdk";
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
  HttpApi,
  HttpMethod,
  HttpRoute,
  HttpRouteKey,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { getDomainEntry } from "../utils/getEntry";

interface FlexDomainStackProps {
  domain: IDomain;
  httpApi: HttpApi;
}

export class FlexDomainStack extends GovUkOnceStack {
  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();
  domain: string;
  #httpApi: HttpApi;
  #domainsResource: IResource;

  constructor(
    scope: Construct,
    id: string,
    { domain: { domain, owner, versions }, httpApi }: FlexDomainStackProps,
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

  processRoutes(versionedRoutes: IDomainRoutes) {
    for (const [versionId, versionConfig] of Object.entries(
      versionedRoutes.versions,
    )) {
      for (const [path, methodMap] of Object.entries(versionConfig.routes)) {
        for (const [methodKey, routeConfig] of Object.entries(methodMap)) {
          const method = methodKey as HttpMethod;

          const { resolvedVars, envGrantables } = this.#resolveEnvironment(
            routeConfig.env,
            routeConfig.envSecret,
          );

          const { kmsGrantables } = this.#resolveKms(routeConfig.kmsKeys);

          const domainEndpointFn = this.#createFunction(
            routeConfig,
            this.domain,
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

          this.createApiRoute(
            this.#httpApi,
            this.domain,
            versionId,
            path,
            method,
            domainEndpointFn.function,
          );

          if (routeConfig.permissions && routeConfig.permissions.length > 0) {
            this.#grantPermissions(
              domainEndpointFn.function.role,
              routeConfig.permissions,
              this.domain,
            );
          }
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
      entry: getDomainEntry(domain, entry),
      environment,
      timeout: Duration.seconds(60),
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
  protected createApiRoute(
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
      httpApi,
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

  /**
   * Grants IAM permissions for private API access based on route permissions config
   */
  #grantPermissions(
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
        // gateway permissions are only allowed intra-domain
        base = `/gateways/${domain}`;
      }

      const suffix = perm.path.startsWith("/") ? perm.path : `/${perm.path}`;
      routePrefixes.push(`${base}${suffix}`);

      if (perm.method && !methods.includes(perm.method)) {
        methods.push(perm.method);
      }
    }

    if (routePrefixes.length > 0) {
      grantPrivateApiAccess(role, this.#domainsResource, {
        domainId: domain,
        allowedRoutePrefixes: routePrefixes,
        allowedMethods: methods.length > 0 ? methods : undefined,
      });
    }
  }
}
