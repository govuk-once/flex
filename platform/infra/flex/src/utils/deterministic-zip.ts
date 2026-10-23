import crypto from "node:crypto";
import zlib from "node:zlib";

export interface ZipFileEntry {
  /**
   * Relative file path inside the zip archive (e.g. "index.js").
   */
  readonly path: string;
  /**
   * Raw file content as a Buffer or UTF-8 string.
   */
  readonly content: Buffer | string;
}

export interface DeterministicZipResult {
  /**
   * Complete binary PKZIP archive buffer.
   */
  readonly buffer: Buffer;
  /**
   * Hex-encoded SHA-256 content hash of the zip archive buffer.
   */
  readonly sha256: string;
}

// Fixed MS-DOS epoch timestamp: 1980-01-01 00:00:00 UTC
const FIXED_DOS_TIME = 0x0000;
const FIXED_DOS_DATE = 0x0021;

// ZIP format constants
const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;
const VERSION_MADE_BY_UNIX = (3 << 8) | 20; // Unix (3), ZIP spec 2.0 (20)
const VERSION_NEEDED = 20; // 2.0
const UTF8_FLAG = 0x0800; // Bit 11: filename is UTF-8 encoded
const METHOD_DEFLATE = 8;
const UNIX_FILE_ATTR_644 = (0o100644 << 16) >>> 0;

function normalizeZipPath(rawPath: string): string {
  const normalized = rawPath
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid zip entry path: "${rawPath}"`);
  }

  return normalized;
}

/**
 * Creates a byte-for-byte deterministic ZIP archive from the given entries.
 *
 * Determinism guarantees:
 * - Entries are sorted lexicographically by normalized UTF-8 path.
 * - Modification timestamps are pinned to 1980-01-01 00:00:00.
 * - File permissions are normalized to 0644 across all platforms.
 * - Deflate compression uses fixed level 9 with no OS-specific extra headers.
 */
export function createDeterministicZip(
  entries: readonly ZipFileEntry[],
): DeterministicZipResult {
  if (entries.length === 0) {
    throw new Error("Cannot create a deterministic zip from an empty entry list");
  }

  const normalizedEntries = entries.map((entry) => ({
    path: normalizeZipPath(entry.path),
    content:
      typeof entry.content === "string"
        ? Buffer.from(entry.content, "utf-8")
        : Buffer.from(entry.content),
  }));

  normalizedEntries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const seenPaths = new Set<string>();
  for (const entry of normalizedEntries) {
    if (seenPaths.has(entry.path)) {
      throw new Error(`Duplicate zip entry path: "${entry.path}"`);
    }
    seenPaths.add(entry.path);
  }

  const localParts: Buffer[] = [];
  const centralDirParts: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of normalizedEntries) {
    const fileNameBuffer = Buffer.from(entry.path, "utf-8");
    const uncompressedSize = entry.content.length;
    const crc = zlib.crc32(entry.content) >>> 0;
    const compressedData = zlib.deflateRawSync(entry.content, { level: 9 });
    const compressedSize = compressedData.length;

    // 1. Local File Header (30 bytes + file name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(METHOD_DEFLATE, 8);
    localHeader.writeUInt16LE(FIXED_DOS_TIME, 10);
    localHeader.writeUInt16LE(FIXED_DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, fileNameBuffer, compressedData);

    // 2. Central Directory File Header (46 bytes + file name)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    centralHeader.writeUInt16LE(VERSION_MADE_BY_UNIX, 4);
    centralHeader.writeUInt16LE(VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(METHOD_DEFLATE, 10);
    centralHeader.writeUInt16LE(FIXED_DOS_TIME, 12);
    centralHeader.writeUInt16LE(FIXED_DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(UNIX_FILE_ATTR_644, 38);
    centralHeader.writeUInt32LE(currentOffset, 42);

    centralDirParts.push(centralHeader, fileNameBuffer);

    currentOffset += localHeader.length + fileNameBuffer.length + compressedSize;
  }

  const centralDirBuffer = Buffer.concat(centralDirParts);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = currentOffset;

  // 3. End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(normalizedEntries.length, 8);
  eocd.writeUInt16LE(normalizedEntries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  const buffer = Buffer.concat([...localParts, centralDirBuffer, eocd]);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  return { buffer, sha256 };
}
