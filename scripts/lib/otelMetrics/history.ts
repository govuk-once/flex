import fs from "node:fs";
import path from "node:path";

import type { EnrichmentMode } from "./namespaces";

export const ENABLED_MARKER = "enabled-by-spike.json";

export interface EnabledMarker {
  account: string;
  region: string;
  mode: EnrichmentMode;
  startedResourceTags: boolean;
  startedAt: string;
}

function readMarker(file: string): EnabledMarker | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as EnabledMarker;
  } catch {
    return undefined;
  }
}

export function findEnabledMarker(
  root: string,
  account: string,
  region: string,
): EnabledMarker | undefined {
  const directory = path.resolve(root);
  const names = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
  return names
    .filter((name) => name.endsWith("-enable"))
    .sort()
    .map((name) => readMarker(path.join(directory, name, ENABLED_MARKER)))
    .filter(
      (marker): marker is EnabledMarker =>
        marker?.account === account && marker.region === region,
    )
    .at(-1);
}
