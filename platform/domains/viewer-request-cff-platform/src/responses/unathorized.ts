export const unathorizedResponse = {
  statusCode: 401,
  body: {
    encoding: "text",
    data: JSON.stringify({ message: "Unauthorized", type: "auth_error" }),
  },
  headers: {
    "content-type": { value: "application/json" },
    "x-rejected-by": { value: "cloudfront-function" },
  },
};
