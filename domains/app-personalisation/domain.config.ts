import { domain } from "@flex/sdk";

export const { config, route, routeContext } = domain({
  name: "app-personalisation",
  environments: ["development", "staging"],
  common: {
    access: "isolated",
    function: { timeoutSeconds: 20 },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  routes: {},
});
