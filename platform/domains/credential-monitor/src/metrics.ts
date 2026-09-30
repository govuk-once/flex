export const METRIC_NAMESPACE = "Flex/Credentials";

export const MetricName = {
  SecretRotationOverdue: "SecretRotationOverdue",
  SecretRotationUnverifiable: "SecretRotationUnverifiable",
  CognitoConfigDrift: "CognitoConfigDrift",
  CredentialMonitorSuccess: "CredentialMonitorSuccess",
} as const;

export type MetricName = (typeof MetricName)[keyof typeof MetricName];
