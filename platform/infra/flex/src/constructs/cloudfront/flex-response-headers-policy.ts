import { Duration } from "aws-cdk-lib";
import {
  HeadersFrameOption,
  HeadersReferrerPolicy,
  ResponseHeadersPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";

interface FlexResponseHeadersPolicyProps {
  policyName: string;
  contentSecurityPolicy?: string;
  noStore?: boolean;
}

export class FlexResponseHeadersPolicy extends Construct {
  public readonly policy: ResponseHeadersPolicy;

  constructor(
    scope: Construct,
    id: string,
    {
      policyName,
      contentSecurityPolicy,
      noStore,
    }: FlexResponseHeadersPolicyProps,
  ) {
    super(scope, id);

    const cacheControlHeader = noStore
      ? [{ header: "Cache-Control", value: "no-store", override: true }]
      : [];

    this.policy = new ResponseHeadersPolicy(this, "Policy", {
      responseHeadersPolicyName: policyName,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.NO_REFERRER,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        ...(contentSecurityPolicy
          ? {
              contentSecurityPolicy: {
                contentSecurityPolicy,
                override: true,
              },
            }
          : {}),
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: "X-Permitted-Cross-Domain-Policies",
            value: "none",
            override: true,
          },
          ...cacheControlHeader,
        ],
      },
    });
  }
}
