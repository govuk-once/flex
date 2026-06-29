import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { routeContext } from "@domain";
import { JwkSet } from "@schemas/wellKnownJwks";
import createHttpError from "http-errors";
import * as jose from "jose";

type PostRoute = "POST /v1/identity/:service";
const _postCtx = routeContext<PostRoute>;
type PostRouteContext = ReturnType<typeof _postCtx>;

interface DvlaJwtPayload extends jose.JWTPayload {
  linking_id?: string;
}

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || "eu-west-1",
});
const KMS_KEY_ID = process.env.decyrptionKey;

async function decryptJweToken(
  jweToken: string,
  ctx: PostRouteContext,
): Promise<string> {
  try {
    const parts = jweToken.split(".");
    if (parts.length !== 5) {
      throw new createHttpError.BadRequest(
        "Invalid token format. Expected a 5-part JWE compact serialization.",
      );
    }

    const [protectedHeaderB64, encryptedCekB64, ivB64, ciphertextB64, tagB64] =
      parts;

    if (
      !protectedHeaderB64 ||
      !encryptedCekB64 ||
      !ivB64 ||
      !ciphertextB64 ||
      !tagB64
    ) {
      throw new createHttpError.BadRequest(
        "Invalid JWE structure: Missing essential token blocks.",
      );
    }

    ctx.logger.info("Extracting and decrypting JWE CEK via AWS KMS...");

    /** Send the encrypted CEK segment to AWS KMS to decrypt via RSA-OAEP (SHA-1) */
    const ciphertextBuffer = Buffer.from(encryptedCekB64, "base64url");
    const decryptCommand = new DecryptCommand({
      KeyId: KMS_KEY_ID,
      CiphertextBlob: ciphertextBuffer,
      EncryptionAlgorithm: "RSAES_OAEP_SHA_1",
    });

    const kmsResponse = await kmsClient.send(decryptCommand);

    if (!kmsResponse.Plaintext) {
      ctx.logger.error(
        "KMS Decrypt returned an empty Plaintext CEK payload unexpectedly.",
      );
      throw new createHttpError.InternalServerError(
        "Secure decryption failed internally",
      );
    }

    /** Import the raw decrypted key bytes as a native AES-GCM crypto key */
    const rawDecryptedCek = kmsResponse.Plaintext;
    const aesKey = await crypto.subtle.importKey(
      "raw",
      Buffer.from(rawDecryptedCek),
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"],
    );

    /** Prepare the JWE payloads for native Web Crypto AES-GCM decryption */
    const iv = Buffer.from(ivB64, "base64url");
    const ciphertext = Buffer.from(ciphertextB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");

    /** In Web Crypto API, the authentication tag must be appended to the end of the ciphertext buffer */
    const encryptedDataWithTag = Buffer.concat([ciphertext, tag]);

    /** In the JWE specification, the ASCII representation of the base64url protected header acts as the AAD */
    const additionalAuthenticatedData = Buffer.from(
      protectedHeaderB64,
      "ascii",
    );

    ctx.logger.info(
      "Decrypting internal JWE payload via native AES-256-GCM...",
    );

    /** Perform the raw symmetric data decryption */
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        additionalData: additionalAuthenticatedData,
        tagLength: 128,
      },
      aesKey,
      encryptedDataWithTag,
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    if (createHttpError.isHttpError(error)) throw error;

    ctx.logger.error("Failed to decrypt JWE wrapper layer", { error });
    throw new createHttpError.BadRequest("Invalid encrypted token payload");
  }
}

async function verifyJwtAndExtractLinkingId(
  signedJwt: string,
  jwkSet: JwkSet,
  ctx: PostRouteContext,
): Promise<string | null> {
  try {
    const JWKS = jose.createLocalJWKSet(jwkSet);

    /**
     * TODO
     *  - remove the below for actually PR back to present date
     */
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { payload } = await jose.jwtVerify<DvlaJwtPayload>(signedJwt, JWKS, {
      currentDate: oneYearAgo,
      clockTolerance: 0,
    });

    return payload.linking_id ?? null;
  } catch (error) {
    ctx.logger.error("Failed to verify internal JWT signature", { error });
    return null;
  }
}

export async function extractServiceId(
  service: string,
  token: string,
  ctx: PostRouteContext,
): Promise<string | null> {
  if (service.toLowerCase() === "dvla") {
    const decryptedSignedJwt = await decryptJweToken(token, ctx);

    const result = await ctx.integrations.dvlaGetWellKnownJwk({});
    if (!result.ok) {
      ctx.logger.error("Failed to fetch DVLA well-known JWKs", {
        error: result.error,
      });
      throw new createHttpError.BadGateway();
    }

    return await verifyJwtAndExtractLinkingId(
      decryptedSignedJwt,
      result.data,
      ctx,
    );
  }

  return token;
}
