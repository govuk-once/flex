import { z } from "zod";

const StringOrArraySchema = z.union([z.string(), z.array(z.string())]);

export const PolicyStatementSchema = z
  .object({
    Sid: z.string().optional(),
    Effect: z.string().optional(),
    Principal: z.unknown().optional(),
    Action: StringOrArraySchema.optional(),
    Resource: StringOrArraySchema.optional(),
    Condition: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional(),
  })
  .catchall(z.unknown());

export const BucketPolicySchema = z
  .object({
    Version: z.string().optional(),
    Id: z.string().optional(),
    Statement: z
      .union([PolicyStatementSchema, z.array(PolicyStatementSchema)])
      .optional(),
  })
  .catchall(z.unknown());

export type PolicyStatement = z.infer<typeof PolicyStatementSchema>;
export type BucketPolicy = z.infer<typeof BucketPolicySchema>;

export type BucketStatus =
  | "compliant"
  | "missing-policy"
  | "policy-without-tls";

export const DENY_SID = "DenyInsecureTransport";

export function buildDenyStatement(bucketName: string): PolicyStatement {
  return {
    Sid: DENY_SID,
    Effect: "Deny",
    Principal: "*",
    Action: "s3:*",
    Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
    Condition: { Bool: { "aws:SecureTransport": "false" } },
  };
}

function isSecureTransportFalse(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(isSecureTransportFalse);
  }
  return value === "false" || value === false;
}

export function statementEnforcesSecureTransport(
  statement: PolicyStatement,
): boolean {
  if (statement.Effect !== "Deny") return false;
  const bool = statement.Condition?.Bool;
  if (!bool) return false;
  return isSecureTransportFalse(bool["aws:SecureTransport"]);
}

function toStatementArray(
  statement: PolicyStatement | PolicyStatement[] | undefined,
): PolicyStatement[] {
  if (!statement) return [];
  return Array.isArray(statement) ? statement : [statement];
}

export function hasSecureTransportDeny(
  policy: BucketPolicy | undefined,
): boolean {
  return toStatementArray(policy?.Statement).some(
    statementEnforcesSecureTransport,
  );
}

export function parsePolicy(raw: string | undefined): BucketPolicy | undefined {
  if (!raw) return undefined;
  return BucketPolicySchema.parse(JSON.parse(raw));
}

export function classifyPolicy(policy: BucketPolicy | undefined): BucketStatus {
  if (!policy) return "missing-policy";
  return hasSecureTransportDeny(policy) ? "compliant" : "policy-without-tls";
}

export function mergePolicy(
  existing: BucketPolicy | undefined,
  bucketName: string,
): BucketPolicy {
  const denyStatement = buildDenyStatement(bucketName);
  const statements = toStatementArray(existing?.Statement);
  return {
    ...existing,
    Version: existing?.Version ?? "2012-10-17",
    Statement: [...statements, denyStatement],
  };
}

const PERSISTENT_ENVIRONMENTS = new Set([
  "development",
  "staging",
  "production",
]);
const STAGE_STACK_PREFIX = /^(.+?)-flex[a-z]/;

export function isEphemeralStageBucket(name: string): boolean {
  const stage = name.match(STAGE_STACK_PREFIX)?.[1];
  if (!stage) return false;
  return !PERSISTENT_ENVIRONMENTS.has(stage);
}
