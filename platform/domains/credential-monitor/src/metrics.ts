export const METRIC_NAMESPACE = "Flex/Credentials";

export const MetricName = {
  SecretRotationOverdue: "SecretRotationOverdue", // pragma: allowlist secret
  SecretRotationUnverifiable: "SecretRotationUnverifiable", // pragma: allowlist secret
  CognitoConfigDrift: "CognitoConfigDrift",
  CredentialMonitorSuccess: "CredentialMonitorSuccess",
} as const;

export type MetricName = (typeof MetricName)[keyof typeof MetricName];
