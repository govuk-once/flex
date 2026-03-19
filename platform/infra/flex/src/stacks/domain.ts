import { IacDomainConfig, RouteAccess } from "@flex/sdk";
import {
  AuthorizationType,
  IdentitySource,
  IResource,
  LambdaIntegration,
  Resource,
  RestApi,
  TokenAuthorizer,
} from "aws-cdk-lib/aws-apigateway";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "../constructs/lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "../constructs/lambda/flex-public-function";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { getDomainEntry } from "../utils/getEntry";
import { grantRoutePermissions } from "../utils/integrations";
import { toFunctionConfig } from "../utils/lambda";
import { grantRouteResources, importResources } from "../utils/resources";
import {
  flattenRoutes,
  getFunctionAccess,
  resolveRouteReferences,
  toPascalCase,
} from "../utils/routes";

export interface RouteBinding {
  readonly method: string;
  readonly path: string;
}

export class FlexDomainStack extends BaseStack {
  public readonly publicRouteBindings: RouteBinding[] = [];
  public readonly privateRouteBindings: RouteBinding[] = [];

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
    const resourceId = this.import(STAGE_KEYS.ApigwPublicAppRoot);
    return this.#getRestApi("Public", restApiId, resourceId, "/app");
  }

  #getPrivateRestApi() {
    const restApiId = this.import(STAGE_KEYS.ApigwPrivateRestId);
    const resourceId = this.import(STAGE_KEYS.ApigwPrivateDomainRoot);
    return this.#getRestApi("Private", restApiId, resourceId, "/domains");
  }

  constructor(scope: Construct, id: string, config: IacDomainConfig) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: config.owner ?? "N/A",
        ResourceOwner: config.name,
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    const routes = flattenRoutes(config.routes);
    const [resourceReferences, integrationReferences] = resolveRouteReferences(
      routes,
      { resources: config.resources, integrations: config.integrations },
    );
    const resources = importResources(this, resourceReferences);

    const { restApi: privateRestApi, rootResource: privateDomainsRoot } =
      this.#getPrivateRestApi();
    const { rootResource: publicDomainsRoot } = this.#getPublicRestApi();

    const authorizerFnArn = this.import(STAGE_KEYS.ApigwPublicAuthorizerFn);

    const authorizerFn = Function.fromFunctionAttributes(this, "AuthorizerFn", {
      functionArn: authorizerFnArn,
      sameEnvironment: true,
    });

    const authorizer = new TokenAuthorizer(this, "LambdaAuthorizer", {
      handler: authorizerFn,
      identitySource: IdentitySource.header("Authorization"),
    });

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

        const resolvedPathWithParams = path.replace(/:(\w+)/g, "{$1}");
        const resourcePath = `${config.name}/${version}${resolvedPathWithParams}`;

        if (gateway === "public") {
          this.#addDeepResource(publicDomainsRoot, resourcePath).addMethod(
            method,
            new LambdaIntegration(lambda.function),
            { authorizer },
          );

          this.publicRouteBindings.push({ method, path: resourcePath });
        }

        if (gateway === "private") {
          const resource = this.#addDeepResource(
            privateDomainsRoot,
            resourcePath,
          ).addMethod(method, new LambdaIntegration(lambda.function), {
            authorizationType: AuthorizationType.IAM,
          });

          applyCheckovSkip(
            resource,
            "CKV_AWS_59",
            "Private API - access restricted by VPC endpoint and resource policy",
          );

          this.privateRouteBindings.push({ method, path: resourcePath });
        }
      },
    );
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

  #createFunction(
    id: string,
    access: RouteAccess,
    props: ReturnType<typeof toFunctionConfig> & {
      domain: string;
      entry: string;
    },
  ) {
    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateEgressSg = this.importSecurityGroup(ENV_KEYS.SgPrivateEgress);
    const privateIsolatedSg = this.importSecurityGroup(
      ENV_KEYS.SgPrivateIsolated,
    );

    switch (access) {
      case "public":
        return new FlexPublicFunction(this, id, props);
      case "private":
        return new FlexPrivateEgressFunction(this, id, {
          vpc,
          privateEgressSg,
          ...props,
        });
      case "isolated":
        return new FlexPrivateIsolatedFunction(this, id, {
          vpc,
          privateIsolatedSg,
          ...props,
        });
    }
  }
}
