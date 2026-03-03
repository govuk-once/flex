import { readdirSync, rmSync } from "fs";
import path from "path";

export function clearTmp() {
  const tmpDir = "/tmp";
  for (const file of readdirSync(tmpDir)) {
    rmSync(path.join(tmpDir, file), { recursive: true, force: true });
  }
}
