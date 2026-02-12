import { GovUkOnceStack } from "@platform/gov-uk-once";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

interface IFlexCertStackProps {
  domainConfig: {
    prefix?: string;
    domainName: string;
  };
}

export class FlexCertStack extends GovUkOnceStack {
  certArn: string;

  constructor(scope: Construct, id: string, props: IFlexCertStackProps) {
    super(scope, id, {
      crossRegionReferences: true,
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
    const { domainConfig } = props;

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: domainConfig.domainName,
    });

    let subdomain: string | undefined;
    if (domainConfig.prefix) {
      subdomain = `${domainConfig.prefix}.${domainConfig.domainName}`;
    }

    this.certArn = new Certificate(this, "FlexCert", {
      domainName: domainConfig.domainName,
      subjectAlternativeNames: subdomain ? [subdomain] : undefined,
      validation: CertificateValidation.fromDns(hostedZone),
    }).certificateArn;
  }
}
