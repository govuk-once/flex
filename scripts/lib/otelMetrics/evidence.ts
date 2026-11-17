import fs from "node:fs";
import path from "node:path";

export interface Evidence {
  directory: string;
  save: (name: string, data: unknown) => string;
  line: (text?: string) => void;
  table: (headers: string[], rows: string[][]) => void;
  finish: () => string;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cell(value: string): string {
  return value.replace(/\|/g, String.raw`\|`).replace(/\n/g, " ");
}

export function createEvidence(root: string, command: string): Evidence {
  const directory = path.resolve(root, `${timestamp()}-${command}`);
  fs.mkdirSync(directory, { recursive: true });
  const lines: string[] = [];

  const line = (text = "") => {
    lines.push(text);
    console.log(text);
  };

  return {
    directory,
    save: (name, data) => {
      const file = path.join(directory, name);
      fs.writeFileSync(
        file,
        typeof data === "string" ? data : `${JSON.stringify(data, null, 2)}\n`,
      );
      return path.basename(file);
    },
    line,
    table: (headers, rows) => {
      line(`| ${headers.map(cell).join(" | ")} |`);
      line(`|${headers.map(() => "---").join("|")}|`);
      rows.forEach((row) => {
        line(`| ${row.map(cell).join(" | ")} |`);
      });
      line();
    },
    finish: () => {
      const file = path.join(directory, "summary.md");
      fs.writeFileSync(file, `${lines.join("\n")}\n`);
      console.log(`\nEvidence written to ${directory}`);
      return file;
    },
  };
}
