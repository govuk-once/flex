import type { APIGatewayProxyResultV2 } from "aws-lambda";

// Defined locally without importing `publicJWKS` so @flex/testing can remain a devDependency
const jwks = JSON.stringify({
  keys: [
    {
      alg: "RS256",
      e: "AQAB",
      key_ops: ["sign"],
      kty: "RSA",
      n: "zD5T9VQ4mirMnDOa-Z-Alg2X12NBDNxp1m9ZLTiiT08a7wMDfInDGh5wblIjwolPIDtryk25LfoUl2viVExeCD7AliCSlSBN8ttpLxYtDs0kKmAI3F5SMFrd7KiMB01_itWuDzTNtm4vqU_ZuqzEqzq3586tjD3lsN1vBjMlQZD0r5UdG423Q5qdwNyzBbspjw2zI3rres-FIPQVXWl3VLSmzkSeEIwNXaK5Z5yf9uE5PjZUjKHRgfgOBcfWI8xtmWy_HDvK5eL-3lyoAPYJ4mTNSQjGx7QOsmNKYJlLBilx5f3BdM-rDREhYuYKwj4bEik1_rp5PtoEpu2dC20I9qsPEtgf7r05JD5zhz84zZcZzrF1Sm1AoBsXmCOWIHlGbFql03CVP-JltxLSGNNI2jUosi5YN-78BEScSYnecq22U2wx9k4DT79R81K5ULqHTOcTIex1uy7fR8vGZb61TYDFKb3zHcxnH2P4SpIne5VydOm2fMjjMbJmpskhZv-F", // pragma: allowlist secret
      use: "sig",
      kid: "83fcafa6aad51fddd3c34ad1e9df90d8", // pragma: allowlist secret
    },
  ],
});

export const handler = (): APIGatewayProxyResultV2 => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: jwks,
  };
};
