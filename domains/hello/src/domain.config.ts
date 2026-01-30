import { IRoutes } from "@flex/iac";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

export const endpoints: IRoutes = {
  domain: "hello",
  versions: [
    {
      id: "v1",
      prefix: "/1.0",
      routes: [
        {
          entry: "handlers/hello-private/get.ts",
          method: HttpMethod.GET,
          path: "/hello-private",
          type: "PRIVATE",
        },
        {
          entry: "handlers/hello-public/get.ts",
          method: HttpMethod.GET,
          path: "/hello-public",
          type: "PUBLIC",
        },
        {
          entry: "handlers/hello-isolated/get.ts",
          method: HttpMethod.GET,
          path: "/hello-isolated",
          type: "ISOLATED",
        },
      ],
    },
  ],
};
