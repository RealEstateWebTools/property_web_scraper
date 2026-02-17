const encoder = new TextEncoder();

/**
 * Compare two strings in constant time.
 * Avoids early-return behavior that can leak prefix matches via timing.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);

  // Include length in mismatch value but still iterate full max length.
  let mismatch = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    const aVal = i < aBytes.length ? aBytes[i] : 0;
    const bVal = i < bBytes.length ? bBytes[i] : 0;
    mismatch |= aVal ^ bVal;
  }

  return mismatch === 0;
}
