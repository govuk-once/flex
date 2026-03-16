import { Duration } from "aws-cdk-lib";
import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MockIntegration,
  ResponseType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { Environment, getEnvConfig } from "../base/env";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";
import { createUdpServiceGateway } from "../constructs/gateways/udp";
import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { getPlatformEntry } from "../utils/getEntry";

const { env } = getEnvConfig();

interface FlexPlatformStackProps {
  domainName: string;
  subdomainName?: string;
}

export class FlexPlatformStack extends BaseStack {
  #createStubJwksService() {
    const jwksEndpointStubFunction = new NodejsFunction(
      this,
      "JwksEndpointStubFunction",
      {
        entry: getPlatformEntry("auth", "functions/jwks-endpoint.ts"),
        runtime: Runtime.NODEJS_24_X,
        handler: "handler",
      },
    );

    const accountNumber = process.env.CDK_DEFAULT_ACCOUNT;
    if (accountNumber === undefined) {
      throw new Error("Account number undefined");
    }

    /**
     * Note:
     * - Keeping ARN hard coded as this is the only env this secret is kept in
     */
    jwksEndpointStubFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:eu-west-2:${accountNumber}:secret:/development/flex-secret/auth/e2e/private_jwk-*`,
        ],
      }),
    );

    const jwksEndpointStubFunctionUrl = jwksEndpointStubFunction.addFunctionUrl(
      {
        authType: FunctionUrlAuthType.NONE,
      },
    );
    applyCheckovSkip(
      jwksEndpointStubFunctionUrl,
      "CKV_AWS_258",
      "JWKS endpoint must be publicly accessible for JWT signature verification",
    );

    return jwksEndpointStubFunctionUrl.url;
  }

  #createAuthorizerFunction({
    userPoolId,
    clientId,
    jwksUri,
  }: {
    userPoolId: string;
    clientId: string;
    jwksUri: string;
  }) {
    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateEgressSg = this.importSecurityGroup(ENV_KEYS.SgPrivateEgress);

    return new FlexPrivateEgressFunction(this, "AuthorizerFunction", {
      entry: getPlatformEntry("auth", "handler.ts"),
      timeout: Duration.seconds(10),
      environment: {
        USERPOOL_ID: userPoolId,
        CLIENT_ID: clientId,
        JWKS_URI: jwksUri,
      },
      privateEgressSg,
      vpc,
    });
  }

  #getAuthorizerFunction() {
    // Only in the development env we stub the JWKS service
    if (env === Environment.DEVELOPMENT) {
      const stubUserPoolId = this.import(ENV_KEYS.AuthUserPoolIdStub);
      const stubClientId = this.import(ENV_KEYS.AuthClientIdStub);

      const jwksUri = this.#createStubJwksService();

      return this.#createAuthorizerFunction({
        clientId: stubClientId,
        userPoolId: stubUserPoolId,
        jwksUri,
      });
    }

    const clientId = this.import(ENV_KEYS.AuthClientId);
    const userPoolId = this.import(ENV_KEYS.AuthUserPoolId);

    return this.#createAuthorizerFunction({
      clientId,
      userPoolId,
      jwksUri: `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
    });
  }

  #createRestApi() {
    const restApi = new RestApi(this, "Api", {
      description: "Central API Gateway for the Flex Platform",
      deployOptions: {
        tracingEnabled: true,
        metricsEnabled: true,
        stageName: "prod",
        accessLogDestination: new LogGroupLogDestination(
          new LogGroup(this, "ApiAccessLogs", {
            retention: RetentionDays.ONE_YEAR,
          }),
        ),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
          caller: true,
        }),
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });
    applyCheckovSkip(
      restApi.deploymentStage,
      "CKV_AWS_120",
      "Disabled for now and will renable when caching strategy is defined",
    );

    const healthEndpoint = restApi.root
      .addResource("health")
      .addMethod("GET", new MockIntegration());

    applyCheckovSkip(
      healthEndpoint,
      "CKV_AWS_59",
      "Ignored as this is a health endpoint only. Plus an endpoint is required to deploy the REST API",
    );

    const appRoot = restApi.root.addResource("app");

    restApi.addGatewayResponse("Unauthorized", {
      type: ResponseType.UNAUTHORIZED,
      statusCode: "401",
      templates: {
        "application/json":
          '{"message": "$context.authorizer.errorMessage", "type": "auth_error"}',
      },
    });

    restApi.addGatewayResponse("AccessDenied", {
      type: ResponseType.ACCESS_DENIED,
      statusCode: "403",
      templates: {
        "application/json":
          '{"message": "$context.authorizer.errorMessage", "type": "auth_error"}',
      },
    });

    return {
      restApi,
      appRoot,
    };
  }

  #createPrivateRestApi() {
    const apiGatewayEndpoint = this.importInterfaceVpcEndpoint(
      ENV_KEYS.VpcEApiGateway,
    );

    const privateGateway = new RestApi(this, "PrivateGateway", {
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
          new PolicyStatement({
            effect: Effect.DENY,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              StringNotEquals: {
                "aws:SourceVpce": apiGatewayEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(
          new LogGroup(this, "AccessLogGroup", {
            retention: RetentionDays.ONE_YEAR,
          }),
        ),
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
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
      disableExecuteApiEndpoint: false,
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
        vpcEndpoints: [apiGatewayEndpoint],
      },
    });

    privateGateway.root
      .addResource("health")
      .addMethod("GET", new MockIntegration());

    applyCheckovSkip(
      privateGateway.deploymentStage,
      "CKV_AWS_120",
      "Disabled for now and will renable when caching strategy is defined",
    );

    const domainsRoot = privateGateway.root.addResource("domains");
    const gatewaysRoot = privateGateway.root.addResource("gateways");

    const udpConsumerConfigArn = this.import(ENV_KEYS.UdpConfigSecretArn);
    const udpCmkArn = this.import(ENV_KEYS.UdpCmkArn);
    const udpConsumerRoleArn = this.import(ENV_KEYS.UdpConfigRoleArn);

    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateIsolatedSg = this.importSecurityGroup(
      ENV_KEYS.SgPrivateIsolated,
    );

    createUdpServiceGateway(this, {
      gatewaysResource: gatewaysRoot,
      cmkArn: udpCmkArn,
      consumerConfigArn: udpConsumerConfigArn,
      consumerRoleArn: udpConsumerRoleArn,
      privateIsolatedSg,
      vpc,
    });

    const privateGatewayUrl = privateGateway.url.replace(/\/$/, ""); // remove trailing slash

    return {
      privateGateway,
      privateGatewayUrl,
      domainsRoot,
      gatewaysRoot,
    };
  }

  constructor(
    scope: Construct,
    id: string,
    { domainName, subdomainName }: FlexPlatformStackProps,
  ) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    const { restApi, appRoot } = this.#createRestApi();

    const authorizerFn = this.#getAuthorizerFunction();

    const certArn = this.import(STAGE_KEYS.CertArn, "us-east-1");
    const cert = Certificate.fromCertificateArn(this, "Cert", certArn);

    new FlexCloudfront(this, "Cloudfront", {
      certArn: cert.certificateArn,
      domainName,
      subdomainName,
      restApi,
    });

    const { domainsRoot, gatewaysRoot, privateGateway, privateGatewayUrl } =
      this.#createPrivateRestApi();

    this.exports({
      [STAGE_KEYS.ApigwPublicRestId]: restApi.restApiId,
      [STAGE_KEYS.ApigwPublicAppRoot]: appRoot.resourceId,
      [STAGE_KEYS.ApigwPublicAuthorizerFn]: authorizerFn.function.functionArn,
      [STAGE_KEYS.ApigwPrivateGatewayUrl]: privateGatewayUrl,
      [STAGE_KEYS.ApigwPrivateRestId]: privateGateway.restApiId,
      [STAGE_KEYS.ApigwPrivateDomainRoot]: domainsRoot.resourceId,
      [STAGE_KEYS.ApigwPrivateGatewaysRoot]: gatewaysRoot.resourceId,
    });
  }
}
