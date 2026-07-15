import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./service-gateway";

const GOV_UK_BASE_URL = "https://www.gov.uk";
const FOREIGN_TRAVEL_ADVICE_PATH = "/api/content/foreign-travel-advice";

const FOREIGN_TRAVEL_ADVICE = {
  links: {
    children: [
      {
        content_id: "00a2d263-f4cc-4ed1-9ae8-ce5e73ce4d30",
        api_path: "/api/content/foreign-travel-advice/italy",
        title: "Italy travel advice",
        details: {
          country: {
            name: "Italy",
          },
        },
      },
      {
        content_id: "726afbd8-e8d1-4ef8-a3a8-9d0a4c467014",
        api_path: "/api/content/foreign-travel-advice/gibraltar",
        title: "Gibraltar travel advice",
        details: {
          country: {
            name: "Gibraltar",
          },
        },
      },
    ],
  },
  details: { ignored: true },
};

describe("Travel Service Gateway", () => {
  it("dispatches GET /v1/countries and maps gov.uk children to countries", async ({
    http,
    privateGatewayEvent,
  }) => {
    http
      .url(GOV_UK_BASE_URL)
      .get(FOREIGN_TRAVEL_ADVICE_PATH)
      .reply(200, FOREIGN_TRAVEL_ADVICE);

    const response = await handler(
      privateGatewayEvent.get("/gateways/travel/v1/countries"),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countries: [
          {
            countryId: "00a2d263-f4cc-4ed1-9ae8-ce5e73ce4d30",
            countryName: "Italy",
          },
          {
            countryId: "726afbd8-e8d1-4ef8-a3a8-9d0a4c467014",
            countryName: "Gibraltar",
          },
        ],
      }),
    });
  });
});
