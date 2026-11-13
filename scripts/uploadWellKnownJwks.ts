import { createHash, createPublicKey } from "node:crypto";

import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { getEnvConfig } from "@flex/utils";

const { env, stage } = getEnvConfig();

const BUCKET_NAME = `flex-${stage}-well-known`;
const S3_KEY = ".well-known/jwks.json";
const SSM_KEY_ARNS_PARAM = `/${env}/flex-param/third-party-encryption/key-arns`;

const kmsClient = new KMSClient({ region: "eu-west-2" });
const ssmClient = new SSMClient({ region: "eu-west-2" });
const s3Client = new S3Client({ region: "us-east-1" });

interface Jwk {
  kty: string;
  n: string;
  e: string;
  alg: string;
  use: string;
  kid: string;
  key_ops: string[];
}

function derToJwk(derBytes: Uint8Array): Jwk {
  const publicKey = createPublicKey({
    key: Buffer.from(derBytes),
    format: "der",
    type: "spki",
  });

  const exported = publicKey.export({ format: "jwk" }) as {
    kty: string;
    n: string;
    e: string;
  };

  const kid = createHash("sha256").update(derBytes).digest("hex");

  return {
    kty: exported.kty,
    n: exported.n,
    e: exported.e,
    alg: "RSA-OAEP-256",
    use: "enc",
    kid,
    key_ops: ["encrypt", "wrapKey"],
  };
}

async function getKmsKeyArns(): Promise<string[]> {
  const response = await ssmClient.send(
    new GetParameterCommand({ Name: SSM_KEY_ARNS_PARAM }),
  );

  const value = response.Parameter?.Value;
  if (!value) {
    throw new Error(
      `SSM parameter ${SSM_KEY_ARNS_PARAM} not found or has no value`,
    );
  }

  return value.split(",").filter(Boolean);
}

async function fetchJwks(arns: string[]): Promise<Jwk[]> {
  return Promise.all(
    arns.map(async (arn) => {
      const response = await kmsClient.send(
        new GetPublicKeyCommand({ KeyId: arn.trim() }),
      );

      if (!response.PublicKey) {
        throw new Error(`No public key returned for ${arn}`);
      }

      return derToJwk(response.PublicKey);
    }),
  );
}

async function uploadToS3(body: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: S3_KEY,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=86400, stale-while-revalidate=3600",
    }),
  );
}

async function main(): Promise<void> {
  console.log(`Uploading JWKS to s3://${BUCKET_NAME}/${S3_KEY}`);

  const arns = await getKmsKeyArns();
  console.log(`Found ${String(arns.length)} KMS key ARN(s)`);

  const keys = await fetchJwks(arns);
  const body = JSON.stringify({ keys });

  await uploadToS3(body);
  console.log("JWKS uploaded successfully");
}

main().catch((error: unknown) => {
  console.error("Failed to upload JWKS:", error);
  process.exitCode = 1;
});
