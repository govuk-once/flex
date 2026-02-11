import { spawn } from "node:child_process";
import path from "node:path";

export function runCommand(
  command: string,
  args: string[],
  dir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const absDir = path.resolve(dir);

    const child = spawn(command, args, {
      cwd: absDir,
      stdio: "ignore",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else if (typeof code === "number") {
        reject(new Error(`${command} exited with code ${String(code)}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}
