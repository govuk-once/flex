const LOG_LEVELS = [
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "CRITICAL",
  "SILENT",
];

const DEFAULT_INDEX = LOG_LEVELS.indexOf("INFO");
const CEILING_DEFAULT_INDEX = LOG_LEVELS.indexOf("TRACE");

/**
 * Clamps a requested log level between a floor and ceiling.
 *
 * Higher index = less verbose.
 * - Floor = minimum verbosity — can't go quieter than this
 * - Ceiling = maximum verbosity — can't go noisier than this
 */
export function clampLogLevel(
  requested: string,
  floor: string,
  ceiling: string,
): string {
  const indexOf = (level: string, fallback: number): number => {
    const i = LOG_LEVELS.indexOf(level.toUpperCase());
    return i === -1 ? fallback : i;
  };

  const req = indexOf(requested, DEFAULT_INDEX);
  const flr = indexOf(floor, DEFAULT_INDEX);
  const ceil = indexOf(ceiling, CEILING_DEFAULT_INDEX);
  const clamped = Math.min(flr, Math.max(ceil, req));

  return LOG_LEVELS[clamped] ?? "INFO";
}
