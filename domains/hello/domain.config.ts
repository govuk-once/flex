import { defineDomain } from "@flex/config/domain";

export const endpoints = defineDomain({
  domain: "hello",
  versions: {
    v1: {
      routes: {
        "/hello-public": {
          GET: {
            entry: "handlers/hello-public/get.ts",
            type: "PUBLIC",
          },
        },
        "/hello-private": {
          GET: {
            entry: "handlers/hello-private/get.ts",
            type: "PRIVATE",
          },
        },
        "/hello-isolated": {
          GET: {
            entry: "handlers/hello-isolated/get.ts",
            type: "ISOLATED",
          },
        },
      },
    },
  },
});
