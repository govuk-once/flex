import type { Construct } from "constructs";

import { BaseStack } from "../../base";
import { getEnvConfig } from "../../base/env";
import { addApiGatewayCloudWatchRole } from "./api-gateway";
import { createElastiCacheCluster } from "./cache";
import { addVpcEndpoints } from "./endpoints";
import { createVpc } from "./vpc";

const { env } = getEnvConfig();

export class FlexCoreStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "eu-west-2",
      },
    });

    this.terminationProtection = true;
    addApiGatewayCloudWatchRole(this);

    const {
      securityGroups: { privateEgress, privateIsolated },
      vpc,
    } = createVpc(this);

    const { apiGatewayEndpoint } = addVpcEndpoints({
      vpc,
      securityGroup: privateIsolated,
    });

    const { cacheCluster } = createElastiCacheCluster(this, {
      vpc,
      securityGroups: [privateEgress, privateIsolated],
    });

    this.exportVpc(`/${env}/flex/vpc`, vpc);
    this.exports({
      [`/${env}/flex/sg/private-egress`]: privateEgress.securityGroupId,
      [`/${env}/flex/sg/private-isolated`]: privateIsolated.securityGroupId,
      [`/${env}/flex/vpc-e/api-gateway`]: apiGatewayEndpoint.vpcEndpointId,
      [`/${env}/flex/cache/endpoint`]: cacheCluster.attrPrimaryEndPointAddress,
    });
  }
}
