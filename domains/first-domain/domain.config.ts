import { domain } from "@flex/sdk";
import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const GreetingResponseSchema = z.object({
  message: NonEmptyString,
  topicCount: z.number().optional(),
});

const SelectedTopicsResponseSchema = z.object({
  topics: z.object({
    selectedTopics: z.array(
      z.object({ id: NonEmptyString, title: NonEmptyString }),
    ),
  }),
});

export const { config, route, routeContext } = domain({
  name: "first-domain",
  environments: ["development"],
  common: {
    access: "isolated",
    logLevel: "INFO",
    function: {
      timeoutSeconds: 20,
      memorySize: 128,
      environment: {
        key: "value",
      },
    },
    headers: {
      exampleId: { name: "x-example-id", required: false },
    },
  },
  resources: {
    privateGatewayUrl: {
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    },
  },
  integrations: {
    udpGetTopics: {
      type: "gateway",
      target: "udp",
      route: "GET /v1/topics",
      response: SelectedTopicsResponseSchema,
    },
  },
  routes: {
    v1: {
      "/greeting": {
        GET: {
          public: {
            name: "get-greeting",
            resources: ["privateGatewayUrl"],
            integrations: ["udpGetTopics"],
            response: GreetingResponseSchema,
          },
        },
      },
    },
  },
});
