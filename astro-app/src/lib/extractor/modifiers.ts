/**
 * Composable text modifiers for field extraction.
 * Inspired by Fredy's pipe-delimited modifier chain pattern.
 *
 * Modifiers transform extracted text strings through a pipeline:
 *   ["removeNewline", "trim", "int"]
 * Each modifier receives a string and returns a string.
 */

export type Modifier = (text: string) => string;

export const MODIFIER_REGISTRY: Record<string, Modifier> = {
  trim: (t) => t.trim(),
  int: (t) => String(parseInt(t, 10) || 0),
  float: (t) => String(parseFloat(t) || 0),
  removeNewline: (t) => t.replace(/[\r\n]+/g, ' '),
  stripPunct: (t) => t.replace(/[.,]/g, ''),
  stripFirstChar: (t) => t.slice(1),
  lowercase: (t) => t.toLowerCase(),
  uppercase: (t) => t.toUpperCase(),
  collapseWhitespace: (t) => t.replace(/\s+/g, ' ').trim(),
  stripHtmlEntities: (t) => t.replace(/&[a-z]+;/gi, ''),
  stripCurrency: (t) => t.replace(/[£$€¥₹]/g, ''),
  digitsOnly: (t) => t.replace(/[^\d]/g, ''),
};

/**
 * Apply a sequence of named modifiers to a text string.
 * Unknown modifier names are skipped with a warning.
 */
export function applyModifiers(text: string, modifiers: string[]): string {
  let result = text;
  for (const name of modifiers) {
    const fn = MODIFIER_REGISTRY[name];
    if (fn) {
      result = fn(result);
    } else {
      console.warn(`[Modifiers] Unknown modifier: ${name}`);
    }
  }
  return result;
}

/**
 * Parse a pipe-delimited modifier string into an array.
 * E.g. "removeNewline | trim | int" → ["removeNewline", "trim", "int"]
 */
export function parseModifierString(str: string): string[] {
  return str
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
