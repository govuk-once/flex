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
import { Duration } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { IKey } from "aws-cdk-lib/aws-kms";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import crypto from "crypto";

import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { getDomainEntry } from "../utils/getEntry";
import { FlexEphemeralParam, getParamName } from "../utils/getParamName";
import { grantPrivateApiAccess } from "../utils/grantPrivateApiAccess";

export interface PrivateRouteBinding {
  path: string;
  method: string;
  handler: IFunction;
}

interface FlexPrivateDomainStackProps {
  domain: IDomain;
}

type EnvResourceType = "core-param" | "ephemeral-param" | "secret";

export class FlexPrivateDomainStack extends GovUkOnceStack {
  public readonly privateRouteBindings: PrivateRouteBinding[] = [];
  #envCache = new Map<string, ISecret | IStringParameter>();
  #keyCache = new Map<string, IKey>();

  constructor(
    scope: Construct,
    id: string,
    props: FlexPrivateDomainStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: props.domain.owner ?? "N/A",
        ResourceOwner: props.domain.domain,
        Source: "https://github.com/govuk-once/flex",
      },
    });

    // Import restApiId from SSM — returns a CloudFormation dynamic reference
    // ({{resolve:ssm:...}}), not a CDK cross-stack token. CDK does not detect
    // SSM dynamic references as stack-to-stack dependencies, so no circular dep.
    const restApiId = StringParameter.valueForStringParameter(
      this,
      getParamName("/flex-core/private-gateway/rest-api-id"),
    );

    // Reconstruct a minimal IRestApi — used only for IAM grant ARN construction
    // via arnForExecuteApi(). Route registration happens in FlexPrivateGatewayStack.
    const privateApiForGrants = RestApi.fromRestApiAttributes(
      this,
      "PrivateApiForGrants",
      {
        restApiId,
        rootResourceId: restApiId, // dummy — only restApiId matters for arnForExecuteApi
      },
    );

    this.#processPrivateRoutes(props.domain, privateApiForGrants);
  }

  #processPrivateRoutes(
    domainConfig: IDomain,
    privateApiForGrants: ReturnType<typeof RestApi.fromRestApiAttributes>,
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
            "internal-",
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

          this.privateRouteBindings.push({
            path: newPath,
            method,
            handler: domainEndpointFn.function,
          });

          if (routeConfig.permissions && domainEndpointFn.function.role) {
            this.#grantInternalGatewayPermissions(
              domainEndpointFn.function.role,
              routeConfig.permissions,
              domainConfig.domain,
              privateApiForGrants,
            );
          }
        }
      }
    }
  }

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
      case "PRIVATE":
        return new FlexPrivateEgressFunction(this, id, props);
      case "ISOLATED":
        return new FlexPrivateIsolatedFunction(this, id, props);
      default:
        throw new Error(
          `Unsupported function type "${type}" in private domain config for ${domain}${path}`,
        );
    }
  }

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
    role: import("aws-cdk-lib/aws-iam").IRole,
    permissions: Permission[],
    domainName: string,
    internalApi: ReturnType<typeof RestApi.fromRestApiAttributes>,
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
