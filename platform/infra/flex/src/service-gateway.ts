import { Construct } from "constructs";

import { FlexPrivateIsolatedFunction } from "./constructs/flex-private-isolated-function";
import { PrivateRouteGroup } from "./constructs/private-route-group";
import { getGatewayEntry } from "./utils/getEntry";

interface ServiceGatewayProps {
  /** Pre-created /internal/gateways resource from createPrivateGateway() */
  privateRoutes: PrivateRouteGroup;
}

export function createServiceGateways(
  scope: Construct,
  { privateRoutes }: ServiceGatewayProps,
) {
  //   UDP
  const udpConnector = new FlexPrivateIsolatedFunction(scope, "UdpConnector", {
    entry: getGatewayEntry("udp", "handler.ts"),
    domain: "udp",
    environment: {
      UDP_PRIVATE_API_URL: "foo", // TODO: replace with UDP private API URL
    },
  });
  privateRoutes.addRoute("gateway", "udp", "ANY", udpConnector.function);
}
