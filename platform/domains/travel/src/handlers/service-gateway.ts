import { createRestClient, mapApiResult } from "@flex/service-gateway";

import { createHandler } from "../../gateway.config";
import { ForeignTravelAdviceResponseSchema } from "../schemas/remote/foreign-travel-advice";
import { toCountries } from "../utils/to-countries";

const GOV_UK_BASE_URL = "https://www.gov.uk";
const FOREIGN_TRAVEL_ADVICE_PATH = "/api/content/foreign-travel-advice";

export const handler = createHandler({
  clients: () => ({
    api: createRestClient({
      baseUrl: GOV_UK_BASE_URL,
      auth: { type: "public" },
    }),
  }),
  routes: {
    "GET /v1/countries": async ({ clients: { api } }) => {
      const result = await api.get(FOREIGN_TRAVEL_ADVICE_PATH, {
        schema: ForeignTravelAdviceResponseSchema,
      });

      return mapApiResult(result, (advice) => ({
        countries: toCountries(advice),
      }));
    },
  },
});
