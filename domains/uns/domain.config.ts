import { defineDomain } from "@flex/sdk";

export const endpoints = defineDomain({
  domain: "uns",
  versions: {
    v1: {
      routes: {
        "/notifications": {
          GET: {
            entry: "handlers/v1/notifications/get.ts",
            type: "ISOLATED",
          },
        },
        "/notifications/{notificationId}": {
          GET: {
            entry: "handlers/v1/notifications/[notificationId]/get.ts",
            type: "ISOLATED",
          },
          DELETE: {
            entry: "handlers/v1/notifications/[notificationId]/delete.ts",
            type: "ISOLATED",
          },
        },
        "/notifications/{notificationId}/status": {
          PATCH: {
            entry: "handlers/v1/notifications/[notificationId]/status/patch.ts",
            type: "ISOLATED",
          },
        },
      },
    },
  },
});
