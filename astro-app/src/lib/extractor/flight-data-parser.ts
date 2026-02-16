/**
 * Flight data parser for Next.js React Server Components (RSC).
 *
 * Modern Next.js sites (Rightmove, Zoopla, etc.) stream structured data via
 * `self.__next_f.push()` script tags. This module extracts and parses that data
 * into a flat Record keyed by chunk ID, with all `$N` back-references resolved.
 */

const FLIGHT_DATA_REGEX = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/gs;

/**
 * Unescape a flight data chunk string.
 * These chunks are double-escaped inside the push() call.
 * Uses a single-pass replacement to handle all escape sequences correctly,
 * including `\\n` (literal backslash + n) vs `\n` (newline).
 */
function unescapeChunk(raw: string): string {
  return raw.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case '"': return '"';
      case 'n': return '\n';
      case 't': return '\t';
      case '\\': return '\\';
      case '/': return '/';
      default: return char;
    }
  });
}

/**
 * Parse the key:value lines from concatenated flight data.
 * Each line is formatted as `key:jsonValue` where key is typically a number.
 */
function parseChunkLines(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 1) continue;

    const key = line.slice(0, colonIdx).trim();
    const jsonStr = line.slice(colonIdx + 1);

    // Skip non-numeric keys and empty values
    if (!/^\w+$/.test(key) || !jsonStr.trim()) continue;

    try {
      result[key] = JSON.parse(jsonStr);
    } catch {
      // Not valid JSON — skip (could be a partial chunk or non-JSON line)
    }
  }

  return result;
}

/**
 * Recursively resolve `$N` back-references in parsed flight data.
 * String values like `"$72"` are replaced with the parsed value at key `72`.
 */
function resolveReferences(
  chunks: Record<string, unknown>,
  maxDepth = 10
): Record<string, unknown> {
  function resolve(value: unknown, depth: number): unknown {
    if (depth <= 0) return value;

    if (typeof value === 'string' && /^\$[a-zA-Z0-9]+$/.test(value)) {
      const refKey = value.slice(1);
      if (refKey in chunks) {
        return resolve(chunks[refKey], depth - 1);
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => resolve(item, depth - 1));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        resolved[k] = resolve(v, depth - 1);
      }
      return resolved;
    }

    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(chunks)) {
    result[key] = resolve(value, maxDepth);
  }
  return result;
}

/**
 * Parse all `self.__next_f.push()` flight data from an HTML string.
 *
 * Returns a flat Record keyed by chunk ID with all `$N` references resolved.
 * Returns an empty object if no flight data is found.
 */
export function parseFlightData(html: string): Record<string, unknown> {
  const allChunks: string[] = [];

  let match: RegExpExecArray | null;
  // Reset regex state for each call
  const regex = new RegExp(FLIGHT_DATA_REGEX.source, FLIGHT_DATA_REGEX.flags);
  while ((match = regex.exec(html)) !== null) {
    allChunks.push(match[1]);
  }

  if (allChunks.length === 0) return {};

  const concatenated = allChunks.map(unescapeChunk).join('\n');
  const parsed = parseChunkLines(concatenated);
  return resolveReferences(parsed);
}

/**
 * Search through all parsed flight data objects for a value at the given dot-path.
 *
 * The path is split by `.` and each segment is used to traverse into objects.
 * Searches all top-level chunks and returns the first match found.
 *
 * Example paths:
 *   "price" — finds `{ price: 500000 }` in any chunk
 *   "location.latitude" — finds `{ location: { latitude: 51.5 } }` in any chunk
 */
export function searchFlightData(
  flightData: Record<string, unknown>,
  dotPath: string
): unknown {
  const segments = dotPath.split('.');

  function getByPath(obj: unknown, segs: string[]): unknown {
    let current = obj;
    for (const seg of segs) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }

  // Search through each top-level chunk value
  for (const value of Object.values(flightData)) {
    if (value !== null && typeof value === 'object') {
      const found = getByPath(value, segments);
      if (found !== undefined) return found;
    }
  }

  // Also try top-level keys directly (e.g., path is just a chunk key)
  const directResult = getByPath(flightData, segments);
  if (directResult !== undefined) return directResult;

  return undefined;
}
