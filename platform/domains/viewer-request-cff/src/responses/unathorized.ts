export const unathorizedResponse = {
  statusCode: 401,
  body: {
    encoding: "text",
    data: JSON.stringify({ message: "Unauthorized" }),
  },
  headers: {
    "content-type": { value: "application/json" },
    "x-rejected-by": { value: "cloudfront-function" },
  },
};
