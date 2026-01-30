import { GovUkOnceStack } from "@platform/gov-uk-once";
import type { Construct } from "constructs";

import { createElastiCacheCluster } from "./cache";
import { addVpcEndpoints } from "./endpoints";
import {
  exportInterfaceVpcEndpointToSsm,
  exportSecurityGroupToSsm,
  exportStringToSsm,
  exportVpcToSsm,
} from "./outputs";
import { createVpc } from "./vpc";

export class FlexCoreStack extends GovUkOnceStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
    });

    this.terminationProtection = true;

    const { securityGroups, vpc } = createVpc(this);
    exportVpcToSsm(this, "/flex-core/vpc", vpc);
    exportSecurityGroupToSsm(
      this,
      "/flex-core/security-group/private-egress",
      securityGroups.privateEgress,
    );
    exportSecurityGroupToSsm(
      this,
      "/flex-core/security-group/private-isolated",
      securityGroups.privateIsolated,
    );

    const { apiGatewayEndpoint } = addVpcEndpoints({
      vpc,
      securityGroup: securityGroups.privateIsolated,
    });
    exportInterfaceVpcEndpointToSsm(
      this,
      "/flex-core/vpc-endpoint/api-gateway",
      apiGatewayEndpoint,
    );

    const { cacheCluster } = createElastiCacheCluster(this, {
      vpc,
      securityGroups: [
        securityGroups.privateEgress,
        securityGroups.privateIsolated,
      ],
    });
    exportStringToSsm(
      this,
      "/flex-core/cache/endpoint",
      cacheCluster.attrPrimaryEndPointAddress,
    );
  }
}
