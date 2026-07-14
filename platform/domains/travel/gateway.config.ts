import { defineGateway } from "@flex/service-gateway";
import { GetCountriesResponseSchema } from "./src";

export const { config, createHandler } = defineGateway({
  name: "travel",
  environments: ["development", "staging"],
  access: "private",
  resources: {},
  policy: {},
  routes: {
    "GET /v1/countries": {
      name: "getCountries",
      response: GetCountriesResponseSchema,
    },
  },
});
