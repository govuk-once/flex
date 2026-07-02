// eslint-disable-next-line unicorn/prefer-node-protocol
import crypto from "crypto";

export function requestIdToUuidV4(requestId: string) {
  const hex = crypto.createHash("sha256").update(requestId).digest("hex");

  // char & 0x3 -> keep low 2 bits, so it collapses to 0,1,2,3
  // then | 0x8 -> adds 8 (1000) so shifts it to 8,9,a,b
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16), // uuidv4
    variant + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}
