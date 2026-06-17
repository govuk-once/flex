import { CloudFrontFunctionsEvent } from "aws-lambda";

// Paths that should resolve to <path>/index.html
const paths = ["/docs"];

export function handler(event: CloudFrontFunctionsEvent) {
  const request = event.request;
  const uri = request.uri;

  for (let i = 0; i <= paths.length; i++) {
    const path = paths[i];
    if (!path) continue;

    // /docs -> redirect to /docs/
    if (uri === path) {
      return {
        statusCode: 301,
        statusDescription: "Moved Permanently",
        headers: { location: { value: path + "/" } },
      };
    }

    // /docs/ -> serve the index
    if (uri === path + "/") {
      request.uri = path + "/index.html";
    }
  }

  return request;
}
