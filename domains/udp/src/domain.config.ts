import { IRoutes } from "@flex/iac";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

export const endpoints: IRoutes = {
  domain: "udp",
  routes: [
    {
      entry: "handlers/post-login/post.ts",
      path: "/user",
      method: HttpMethod.POST,
      type: "ISOLATED",
      envSecret: {
        FLEX_UDP_NOTIFICATION_SECRET:
          "/flex-secret/udp/notification-hash-secret",
      },
    },
  ],
};
