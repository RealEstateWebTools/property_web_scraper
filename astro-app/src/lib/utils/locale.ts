/** Extract the primary language subtag from a BCP-47 locale code.
 *  "de-DE" → "de", "en-AU" → "en", "zh-Hant-TW" → "zh", "es" → "es"
 */
export function primaryLanguage(localeCode: string): string {
  return localeCode.split('-')[0].toLowerCase();
}
