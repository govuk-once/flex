import { domain } from "@flex/sdk";
import { SearchTermSchema, UserSearchesSchema } from "@schemas/search";

export const { config, route, routeContext } = domain({
    name: "searches",
    environments: ["development"],
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
    integrations: {
        udpPostSearch: {
            type: "gateway",
            target: "udp",
            route: "POST /v1/activity/searches",
            body: UserSearchesSchema,
            response: UserSearchesSchema,
        },
    },
    routes: {
        v1: {
            "/activity/searches": {
                PATCH: {
                    public: {
                        name: "upsert-searches",
                        resources: ["privateGatewayUrl"],
                        integrations: ["udpPostSearch"],
                        body: SearchTermSchema,
                    },
                },
            },
        },
    },
});
