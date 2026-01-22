export type CloudFrontFunctionResponse = {
  statusCode: number;
  body?: {
    encoding: "text" | "base64";
    data: string;
  };
  headers?: {
    [key: string]: { value: string };
  };
};
