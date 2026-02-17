import { IDomain } from "@flex/sdk";
import { importInterfaceVpcEndpointFromSsm } from "@platform/core/outputs";
import { GovUkOnceStack } from "@platform/gov-uk-once";
import {
  AccessLogFormat,
  EndpointType,
  IResource,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { PrivateDomainFactory } from "../constructs/privateDomainFactory";
import { exportFlexPlatformParam } from "../outputs";
import { createServiceGateways } from "../service-gateway/service-gateway";

/**
 * Structure of the private API path tree. Created once and shared so that
 * service gateways and domain internal routes attach to the same tree.
 */
export interface PrivateGatewayStructure {
  privateGateway: RestApi;
  domainsResource: IResource;
  gatewaysResource: IResource;
}

/**
 * Unified stack for the private API gateway, service gateways, and private
 * domain routes. Merged to avoid circular dependency between gateway (which
 * references Lambda integrations) and domain stacks (which need domainsResource).
 */
export class FlexPrivateGatewayStack extends GovUkOnceStack {
  public readonly privateGateway: RestApi;
  public readonly domainsResource: IResource;

  constructor(
    scope: Construct,
    id: string,
    props: {
      domains: IDomain[];
      httpApi: HttpApi;
    },
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    const { privateGateway, domainsResource, gatewaysResource } =
      this.createPrivateGateway(this);
    this.privateGateway = privateGateway;
    this.domainsResource = domainsResource;

    createServiceGateways(this, gatewaysResource);

    for (const domainProps of props.domains) {
      if (domainProps.private) {
        const domainFactory = new PrivateDomainFactory(
          this,
          `${domainProps.domain}PrivateDomain`,
          {
            domain: domainProps.domain,
            httpApi: props.httpApi,
            domainsResource,
          },
        );
        domainFactory.processRoutes(domainProps.private);
      }
    }
  }

  createPrivateGateway(scope: Construct): PrivateGatewayStructure {
    const apiGatewayEndpoint = importInterfaceVpcEndpointFromSsm(
      scope,
      "/flex-core/vpc-endpoint/api-gateway",
    );

    const accessLogGroup = new LogGroup(scope, "AccessLogGroup", {
      retention: RetentionDays.ONE_MONTH,
    });

    const privateGateway = new RestApi(scope, "PrivateGateway", {
      description:
        "Private API Gateway - Internal service-to-service and domain-to-gateway routing",
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              StringEquals: {
                "aws:SourceVpce": apiGatewayEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      disableExecuteApiEndpoint: false,
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
        vpcEndpoints: [apiGatewayEndpoint],
      },
    });

    privateGateway.grantInvokeFromVpcEndpointsOnly([apiGatewayEndpoint]);

    const domainsResource = privateGateway.root.addResource("domains");
    const gatewaysResource = privateGateway.root.addResource("gateways");

    exportFlexPlatformParam(
      scope,
      "/flex-core/private-gateway/url",
      privateGateway.url.replace(/\/$/, ""), // remove trailing slash
    );

    return {
      privateGateway,
      domainsResource,
      gatewaysResource,
    };
  }
}
