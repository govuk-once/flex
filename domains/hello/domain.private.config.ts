import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "hello",
  versions: {
    v1: {
      routes: {
        "/hello-internal": {
          GET: {
            type: "ISOLATED",
            entry: "handlers/v1/hello-internal/get.ts",
          },
        },
      },
    },
  },
});
