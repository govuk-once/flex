import { IDomainEndpoint, IRoutes } from "@flex/iac";
import { FlexSecret, importFlexSecret } from "@platform/core/outputs";
import { NestedStack } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

import { getEntry } from "../utils/getEntry";
import { FlexPrivateEgressFunction } from "./lambda/flex-private-egress-function";
import { FlexPrivateIsolatedFunction } from "./lambda/flex-private-isolated-function";
import { FlexPublicFunction } from "./lambda/flex-public-function";

export class domainFactory extends NestedStack {
  private secretsCache = new Map<string, ISecret>();

  constructor(
    scope: Construct,
    id: string,
    domainRoutes: IRoutes,
    httpApi: HttpApi,
  ) {
    super(scope, id);
    const { versions, domain } = domainRoutes;

    versions.forEach((version) => {
      version.routes.forEach((route) => {
        const { envSecret, method, path } = route;
        const resolvedEnvVars: Record<string, string> = {};
        const secretsToGrant: ISecret[] = [];

        if (envSecret) {
          Object.entries(envSecret).forEach(([envKey, secretPath]) => {
            const secret = this._getOrImportSecret(secretPath as FlexSecret);
            resolvedEnvVars[envKey] = secret.secretName;
            secretsToGrant.push(secret);
          });
        }

        const domainEndpointFn = this._getEndpointFnType(
          route,
          domain,
          version.id,
          resolvedEnvVars,
        );

        secretsToGrant.forEach((secret) => {
          secret.grantRead(domainEndpointFn.function);
        });

        const fullPath = `${version.prefix}${path}`.replace(/\/\//g, "/");

        const cleanPathId = path.replace(/\//g, "");
        const integrationId = `${domain}-${version.id}-${method}-${cleanPathId}`;

        httpApi.addRoutes({
          path: fullPath,
          methods: [route.method],
          integration: new HttpLambdaIntegration(
            integrationId,
            domainEndpointFn.function,
          ),
        });
      });
    });
  }

  private _getOrImportSecret(secretPath: FlexSecret): ISecret {
    if (this.secretsCache.has(secretPath)) {
      return this.secretsCache.get(secretPath)!;
    }

    const secret = importFlexSecret(this, secretPath);
    this.secretsCache.set(secretPath, secret);
    return secret;
  }

  private _getEndpointFnType(
    route: IDomainEndpoint,
    domain: string,
    versionId: string,
    environment?: Record<string, string>,
  ) {
    const { entry, type } = route;
    const id = `${versionId}-${route.path}-${route.method}`;
    let domainEndpointFn;

    switch (type) {
      case "PUBLIC":
        domainEndpointFn = new FlexPublicFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
      case "PRIVATE":
        domainEndpointFn = new FlexPrivateEgressFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
      case "ISOLATED":
        domainEndpointFn = new FlexPrivateIsolatedFunction(this, id, {
          domain,
          entry: getEntry(domain, entry),
          environment,
        });
        break;
    }

    return domainEndpointFn;
  }
}
