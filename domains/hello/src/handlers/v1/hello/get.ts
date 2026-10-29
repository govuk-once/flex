import { route } from "@domain";
import type { GetHelloResponse } from "@schemas/hello";

const response: GetHelloResponse = { reponse: "Hello Lorenzo" };

export const handler = route("GET /v1/hello", () => {
  return {
    status: 200,
    data: response,
  };
});
