import { createChildLogger } from "@flex/logging";
import { readdirSync, rmSync } from "fs";
import path from "path";

export function clearTmp() {
  const tmpDir = "/tmp";
  const logger = createChildLogger({ function: "clearTmp" });
  // This is to prevent /tmp from being cleared during testing of other libraries that might not expect to mock this module
  // usually wouldn't want tests to have side effects like this, but in this case it's necessary to prevent issues with deleting files
  // on host machines during testing.
  const isTest = process.env.NODE_ENV === "test";
  if (isTest) {
    return;
  }

  readdirSync(tmpDir).forEach((file) => {
    try {
      logger.debug(`Attempting to delete file ${file} in /tmp`);
      rmSync(path.join(tmpDir, file), { recursive: true, force: true });
    } catch (err) {
      logger.error(
        `Failed to delete file ${file} in /tmp:`,
        err instanceof Error ? err : JSON.stringify(err),
      );
    }
  });
  return;
}
