import { buildCloudFrontEvent } from "@flex/testing";
import { describe, expect, it } from "vitest";

import { handler } from "./handler";

const run = (uri: string) =>
  handler(buildCloudFrontEvent({ request: { uri } }));

describe("handler", () => {
  it("redirects /docs to /docs/", () => {
    expect(run("/docs")).toEqual({
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: "/docs/" } },
    });
  });

  it("rewrites /docs/ to /docs/index.html", () => {
    expect(run("/docs/")).toMatchObject({ uri: "/docs/index.html" });
  });

  it.each(["/docs/vendor", "/docs/vendor/", "/", "/styles.css"])(
    "leaves %s unchanged",
    (uri) => {
      expect(run(uri)).toMatchObject({ uri });
    },
  );
});
