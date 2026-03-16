import type { Construct } from "constructs";

import { BaseStack } from "../../base";
import { ENV_KEYS } from "../../ssm-keys";
import { addApiGatewayCloudWatchRole } from "./api-gateway";
import { createElastiCacheCluster } from "./cache";
import { addVpcEndpoints } from "./endpoints";
import { createVpc } from "./vpc";

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

    this.exportVpc(ENV_KEYS.Vpc, vpc);
    this.exports({
      [ENV_KEYS.CacheEndpoint]: cacheCluster.attrPrimaryEndPointAddress,
      [ENV_KEYS.SgPrivateEgress]: privateEgress.securityGroupId,
      [ENV_KEYS.SgPrivateIsolated]: privateIsolated.securityGroupId,
      [ENV_KEYS.VpcEApiGateway]: apiGatewayEndpoint.vpcEndpointId,
    });
  }
}
