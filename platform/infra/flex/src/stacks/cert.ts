import { GovUkOnceStack } from "@platform/gov-uk-once";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

interface FlexCertStackProps {
  domainName: string;
  subdomainName?: string;
}

export class FlexCertStack extends GovUkOnceStack {
  certArn: string;

  constructor(
    scope: Construct,
    id: string,
    { domainName, subdomainName }: FlexCertStackProps,
  ) {
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

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName,
    });

    this.certArn = new Certificate(this, "FlexCert", {
      domainName: subdomainName ?? domainName,
      validation: CertificateValidation.fromDns(hostedZone),
    }).certificateArn;
  }
}
