import { getEnvConfig, GovUkOnceStack } from "@platform/gov-uk-once";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const envConfig = getEnvConfig();

interface FlexCertStackProps {
  domainName: string;
  subdomainName?: string;
}

export class FlexCertStack extends GovUkOnceStack {
  certArnParamName: string;

  constructor(
    scope: Construct,
    id: string,
    { domainName, subdomainName }: FlexCertStackProps,
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
        region: "us-east-1",
      },
    });

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName,
    });

    const cert = new Certificate(this, "FlexCert", {
      domainName: subdomainName ?? domainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    this.certArnParamName = `/${envConfig.stage}/cert/domain-name`;
    new StringParameter(this, "FlexCertArn", {
      parameterName: this.certArnParamName,
      stringValue: cert.certificateArn,
    });
  }
}
