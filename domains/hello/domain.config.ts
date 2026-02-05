import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "hello",
  versions: {
    v1: {
      routes: {
        "/hello-public": {
          GET: {
            entry: "handlers/v1/hello-public/get.ts",
            type: "PUBLIC",
          },
        },
        "/hello-private": {
          GET: {
            entry: "handlers/v1/hello-private/get.ts",
            type: "PRIVATE",
          },
        },
        "/hello-isolated": {
          GET: {
            entry: "handlers/v1/hello-isolated/get.ts",
            type: "ISOLATED",
          },
        },
      },
    },
  },
});
