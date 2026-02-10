import { GovUkOnceStack } from "@platform/gov-uk-once";
import { CfnOutput } from "aws-cdk-lib";
import {
  AuthorizationType,
  LambdaIntegration,
} from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

import { FlexRestApi } from "../constructs/api-gateway/flex-rest-api";
import { FlexCloudfront } from "../constructs/cloudfront/flex-cloudfront";
import { applyCheckovSkip } from "../utils/applyCheckovSkip";
import { resolveApiResource } from "../utils/resources";
import type { PublicRouteBinding } from "./domain";

interface FlexPlatformStackProps {
  certArnParamName: string;
  domainName: string;
  subdomainName?: string;
  publicRouteBindings: PublicRouteBinding[];
}

export class FlexPlatformStack extends GovUkOnceStack {
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
    {
      certArnParamName,
      domainName,
      subdomainName,
      publicRouteBindings,
    }: FlexPlatformStackProps,
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

    const { restApi } = new FlexRestApi(this, "RestApi");

    const certArn = this.#getCertArn(certArnParamName);

    new FlexCloudfront(this, "Cloudfront", {
      certArn,
      domainName,
      subdomainName,
      restApi,
    });

    for (const route of publicRouteBindings) {
      const resource = resolveApiResource(restApi.root, route.path);

      const resourceMethod = resource.addMethod(
        route.method,
        new LambdaIntegration(route.handler),
      );

      if (route.isPublicAccess) {
        applyCheckovSkip(resourceMethod, "CKV_AWS_59", "Known public endpoint");
      }
    }

    new CfnOutput(this, "FlexApiUrl", {
      value: `https://${subdomainName ?? domainName}`,
    });
  }
}
