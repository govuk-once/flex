import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { getEnvConfig } from "../base/env";

const { stage } = getEnvConfig();

interface FlexCertStackProps {
  domainName: string;
  subdomainName?: string;
}

export class FlexCertStack extends BaseStack {
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

    this.export(`/${stage}/cert/cert-arn`, cert.certificateArn);
  }
}
