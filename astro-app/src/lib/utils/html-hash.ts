/** Compute a 16-char SHA-256 hex fingerprint of raw HTML.
 *  Uses Web Crypto (native in Cloudflare Workers + Node 18+).
 */
export async function computeHtmlHash(html: string): Promise<string> {
  const data = new TextEncoder().encode(html);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
