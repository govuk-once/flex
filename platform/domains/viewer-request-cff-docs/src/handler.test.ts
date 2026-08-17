import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./handler";

describe("CloudFront Function: Flex API Docs", () => {
  it("redirects /docs to /docs/", ({ platform }) => {
    const event = platform.cloudFrontEvent.get("/docs");
    const result = handler(event);

    expect(result).toStrictEqual(
      platform.cloudFrontResult(301, {
        statusDescription: "Moved Permanently",
        headers: { location: "/docs/" },
      }),
    );
  });

  it("rewrites /docs/ to /docs/index.html", ({ platform }) => {
    const event = platform.cloudFrontEvent.get("/docs/");
    const result = handler(event);

    expect(result).toBe(event.request);
    expect(event.request.uri).toBe("/docs/index.html");
  });

  it.for(["/docs/vendor", "/docs/vendor/", "/", "/styles.css"])(
    "leaves %s unchanged",
    (uri, { platform }) => {
      const event = platform.cloudFrontEvent.get(uri);
      const result = handler(event);

      expect(result).toBe(event.request);
      expect(event.request.uri).toBe(uri);
    },
  );
});
