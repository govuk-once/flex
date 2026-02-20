import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

import { FlexInternalGateway } from "../constructs/api-gateway/flex-internal-gateway";
import { FlexRestApi } from "../constructs/api-gateway/flex-rest-api";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";

interface FlexPlatformStackProps {
  certArnParamName: string;
  domainName: string;
  subdomainName?: string;
}

export interface PublicApiRef {
  restApiId: string;
  rootResourceId: string;
  stageName: string;
  authorizerId: string;
}

export interface PrivateApiRef {
  restApiId: string;
  stageName: string;
  domainsRootResourceId: string;
  gatewaysRootResourceId: string;
}

export class FlexPlatformStack extends GovUkOnceStack {
  public readonly restApi: RestApi;
  public readonly internalGateway: FlexInternalGateway;
  public readonly restApiRef: PublicApiRef;
  public readonly privateApiRef: PrivateApiRef;

  #getCertArn(certArnParamName: string) {
    const ssmCall = {
      service: "SSM",
      action: "getParameter",
      parameters: { Name: certArnParamName },
      region: "us-east-1",
      physicalResourceId: PhysicalResourceId.of("cert-arn-lookup"),
    };

    const certLookup = new AwsCustomResource(this, "GetCertArn", {
      onCreate: ssmCall,
      onUpdate: ssmCall,
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [
            `arn:aws:ssm:us-east-1:${this.account}:parameter${certArnParamName}`,
          ],
        }),
      ]),
    });

    const cert = Certificate.fromCertificateArn(
      this,
      "Cert",
      certLookup.getResponseField("Parameter.Value"),
    );

    return cert.certificateArn;
  }

  constructor(
    scope: Construct,
    id: string,
    { certArnParamName, domainName, subdomainName }: FlexPlatformStackProps,
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

    const { restApi, authorizerId } = new FlexRestApi(this, "RestApi");
    this.restApi = restApi;
    const certArn = this.#getCertArn(certArnParamName);

    new FlexCloudfront(this, "Cloudfront", {
      certArn,
      domainName,
      subdomainName,
      restApi,
    });

    const internalGateway = new FlexInternalGateway(this, "InternalGateway");
    this.internalGateway = internalGateway;

    // export api attrs/ids to avoid circular dependency between domain and platform stacks
    this.restApiRef = {
      restApiId: restApi.restApiId,
      rootResourceId: restApi.restApiRootResourceId,
      stageName: restApi.deploymentStage.stageName,
      authorizerId: authorizerId,
    };

    this.privateApiRef = {
      restApiId: internalGateway.privateGateway.restApiId,
      stageName: internalGateway.privateGateway.deploymentStage.stageName,
      domainsRootResourceId: internalGateway.domainsRoot.resourceId,
      gatewaysRootResourceId: internalGateway.gatewaysRoot.resourceId,
    };

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });
  }
}
