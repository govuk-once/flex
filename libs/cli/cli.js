#!/usr/bin/env node
import { exec, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));

const tsxPath = join(__dirname, "node_modules", ".bin", "tsx");
const cliPath = join(__dirname, "src", "index.tsx");

function parseEnvFromCliOutput(cliOutput) {
  return cliOutput.split("\n").reduce((acc, line) => {
    line = line.trim();
    if (!line) return acc;

    if (line.startsWith("export")) {
      const match = line.match(/export\s+(\w+)=['"]?([^'";]+)['"]?/);
      if (match) {
        const [, key, value] = match;
        acc[key] = value;
      }
    }

    return acc;
  }, {});
}

async function runExecSafe() {
  try {
    const { stdout } = await execAsync("gds aws once-bl-development-admin -e");
    return parseEnvFromCliOutput(stdout);
  } catch (error) {
    console.log(error.message);
    for (let i = 8; i > 0; i--) {
      process.stdout.write(
        `\rAn error has occured executing the gds-cli command. Skipping AWS login ${i}...`,
      );
      await sleep(1000);
    }
  }
}

const awsEnv = await runExecSafe();

console.clear();
process.on("exit", () => console.clear());

spawn(tsxPath, [cliPath], {
  stdio: "inherit",
  cwd: __dirname,
  env: {
    ...process.env,
    ...awsEnv,
  },
});
