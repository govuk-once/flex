import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

SecretsManagerClient.prototype.send = () =>
  Promise.resolve({
    SecretString: "dummy", // pragma: allowlist secret
  });
