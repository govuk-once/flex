import { Environment, getEnvConfig } from "@flex/utils";
import { CfnOutput, Duration } from "aws-cdk-lib";
import {
  AccessLogFormat,
  AuthorizationType,
  CfnRestApi,
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
  PermissionsBoundary,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { BaseStack } from "../base";
import { importAlarmActions } from "../constructs/alarms/actions";
import { ApiGatewayAlarms } from "../constructs/alarms/api-gateway";
import { AlarmActionProps } from "../constructs/alarms/types";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";
import { createServiceGateway } from "../constructs/gateways/public";
import { createUdpServiceGateway } from "../constructs/gateways/udp";
import { FlexPrivateEgressFunction } from "../constructs/lambda/flex-private-egress-function";
import { ENV_KEYS, STAGE_KEYS } from "../ssm-keys";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { createPermissionsBoundary } from "../utils/createPermissionsBoundary";
import { getPlatformEntry } from "../utils/getEntry";

const { env, stage } = getEnvConfig();

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
    criticalAction,
    warningAction,
  }: {
    userPoolId: string;
    clientId: string;
    jwksUri: string;
  } & AlarmActionProps) {
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
      criticalAction,
      warningAction,
    });
  }

  #getAuthorizerFunction({ criticalAction, warningAction }: AlarmActionProps) {
    // Only in the development env we stub the JWKS service
    if (env === Environment.development) {
      const stubUserPoolId = this.import(ENV_KEYS.AuthUserPoolIdStub);
      const stubClientId = this.import(ENV_KEYS.AuthClientIdStub);

      const jwksUri = this.#createStubJwksService();

      return this.#createAuthorizerFunction({
        clientId: stubClientId,
        userPoolId: stubUserPoolId,
        jwksUri,
        criticalAction,
        warningAction,
      });
    }

    const clientId = this.import(ENV_KEYS.AuthClientId);
    const userPoolId = this.import(ENV_KEYS.AuthUserPoolId);

    return this.#createAuthorizerFunction({
      clientId,
      userPoolId,
      jwksUri: `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      criticalAction,
      warningAction,
    });
  }

  #createRestApi({ criticalAction, warningAction }: AlarmActionProps) {
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

    const cfnApi = restApi.node.defaultChild as CfnRestApi;
    cfnApi.endpointAccessMode = "BASIC";
    cfnApi.securityPolicy = "SecurityPolicy_TLS13_1_2_2021_06";

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

    new ApiGatewayAlarms(this, "GatewayAlarms", {
      alarmNamePrefix: `${stage}-apigw`,
      criticalAction,
      warningAction,
      api: restApi,
    });

    return {
      restApi,
      appRoot,
    };
  }

  #createPrivateRestApi({ criticalAction, warningAction }: AlarmActionProps) {
    const apiGatewayEndpoint = this.importInterfaceVpcEndpoint(
      ENV_KEYS.VpcEApiGateway,
    );

    const privateGateway = new RestApi(this, "PrivateGateway", {
      description:
        "Private API Gateway - Internal service-to-service and domain-to-gateway routing",
      policy: new PolicyDocument({
        statements: [
          // Deny everything that doesn't arrive through the VPC interface endpoint.
          // No explicit Allow is present — for same-account principals this means
          // the IAM policy becomes the sole gate. Callers must have
          // execute-api:Invoke on the specific route ARN in their IAM role.
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

    const dvlaConsumerConfigArn = this.import(ENV_KEYS.DvlaConfigSecretArn);
    const unsConsumerConfigArn = this.import(ENV_KEYS.UnsConfigSecretArn);
    const unsConsumerRoleArn = this.import(ENV_KEYS.UnsConfigRoleArn);

    const udpConsumerConfigArn = this.import(ENV_KEYS.UdpConfigSecretArn);
    const udpCmkArn = this.import(ENV_KEYS.UdpCmkArn);
    const udpConsumerRoleArn = this.import(ENV_KEYS.UdpConfigRoleArn);

    const flexEncryptionKeyArn = this.import(ENV_KEYS.FlexEncryptionKey);

    const vpc = this.importVpc(ENV_KEYS.Vpc);
    const privateEgressSg = this.importSecurityGroup(ENV_KEYS.SgPrivateEgress);
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
      criticalAction,
      warningAction,
    });

    createServiceGateway(this, {
      vpc,
      consumerConfigArn: dvlaConsumerConfigArn,
      gatewaysResource: gatewaysRoot,
      privateEgressSg,
      secretArnEnvVarName: "FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN", // pragma: allowlist secret
      service: "dvla",
      criticalAction,
      warningAction,
      encryptionKeyArn: flexEncryptionKeyArn,
    });

    createServiceGateway(this, {
      vpc,
      consumerConfigArn: unsConsumerConfigArn,
      consumerRoleArn: unsConsumerRoleArn,
      gatewaysResource: gatewaysRoot,
      privateEgressSg,
      secretArnEnvVarName: "FLEX_UNS_CONSUMER_CONFIG_SECRET_ARN", // pragma: allowlist secret
      service: "uns",
      criticalAction,
      warningAction,
      encryptionKeyArn: flexEncryptionKeyArn,
    });

    const privateGatewayUrl = privateGateway.url.replace(/\/$/, ""); // remove trailing slash

    new ApiGatewayAlarms(this, "PrivateGatewayAlarms", {
      alarmNamePrefix: `${stage}-apigw-private`,
      criticalAction,
      warningAction,
      api: privateGateway,
    });

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

    const { criticalAction, warningAction } = importAlarmActions(this, {
      criticalTopicArn: this.import(ENV_KEYS.TopicCriticalAlarms),
      warningTopicArn: this.import(ENV_KEYS.TopicWarningAlarms),
    });

    const { restApi, appRoot } = this.#createRestApi({
      criticalAction,
      warningAction,
    });

    const authorizerFn = this.#getAuthorizerFunction({
      criticalAction,
      warningAction,
    });

    const certArn = this.import(STAGE_KEYS.CertArn, "us-east-1");
    const cert = Certificate.fromCertificateArn(this, "Cert", certArn);

    const { distribution, viewerRequestFunction } = new FlexCloudfront(
      this,
      "Cloudfront",
      {
        certArn: cert.certificateArn,
        domainName,
        subdomainName,
        restApi,
        criticalAction,
        warningAction,
      },
    );

    const { domainsRoot, gatewaysRoot, privateGateway, privateGatewayUrl } =
      this.#createPrivateRestApi({ criticalAction, warningAction });

    const permissionsBoundary = createPermissionsBoundary(
      this,
      "PlatformPermissionsBoundary",
      privateGateway,
    );
    PermissionsBoundary.of(this).apply(permissionsBoundary);

    this.exports({
      [STAGE_KEYS.ApigwPublicRestId]: restApi.restApiId,
      [STAGE_KEYS.ApigwPublicAppRoot]: appRoot.resourceId,
      [STAGE_KEYS.ApigwPublicAuthorizerFn]: authorizerFn.function.functionArn,
      [STAGE_KEYS.ApigwPrivateGatewayUrl]: privateGatewayUrl,
      [STAGE_KEYS.ApigwPrivateRestId]: privateGateway.restApiId,
      [STAGE_KEYS.ApigwPrivateDomainRoot]: domainsRoot.resourceId,
      [STAGE_KEYS.ApigwPrivateGatewaysRoot]: gatewaysRoot.resourceId,
      [STAGE_KEYS.CloudfrontId]: distribution.distributionId,
      [STAGE_KEYS.CloudfrontFunctionName]: viewerRequestFunction.functionName,
      [STAGE_KEYS.CloudfrontFunctionArn]: viewerRequestFunction.functionArn,
    });

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });
    new CfnOutput(this, "PrivateGatewayUrl", { value: privateGatewayUrl });
  }
}
