/**
 * Firebase ID token verification using Web Crypto (CF Workers compatible).
 * No Firebase Admin SDK — uses RS256 via crypto.subtle directly.
 *
 * Reference:
 *   https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface FirebaseTokenPayload {
  uid: string;
  email: string;
  email_verified: boolean;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
  sub: string;
}

interface JwkEntry {
  key: CryptoKey;
  expiresAt: number;
}

// Module-level cache keyed by kid
const jwkCache = new Map<string, JwkEntry>();

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padding);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseCacheControl(header: string | null): number {
  if (!header) return 3600;
  const match = header.match(/max-age=(\d+)/);
  return match ? parseInt(match[1], 10) : 3600;
}

async function getPublicKey(kid: string): Promise<CryptoKey> {
  const now = Math.floor(Date.now() / 1000);
  const cached = jwkCache.get(kid);
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  const resp = await fetch(JWK_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase JWKs: ${resp.status}`);
  }

  const ttl = parseCacheControl(resp.headers.get('Cache-Control'));
  const json = (await resp.json()) as { keys: Array<Record<string, string>> };

  // Import and cache all keys from the response
  for (const jwk of json.keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    jwkCache.set(jwk.kid, { key, expiresAt: now + ttl });
  }

  const entry = jwkCache.get(kid);
  if (!entry) {
    throw new Error(`No Firebase public key found for kid: ${kid}`);
  }
  return entry.key;
}

/**
 * Verify a Firebase ID token.
 *
 * Throws on:
 *  - Malformed token
 *  - Invalid signature
 *  - Expired token
 *  - Wrong issuer / audience
 *
 * Does NOT throw on email_verified === false — the caller decides that.
 */
export async function verifyFirebaseToken(
  idToken: string,
  projectId: string
): Promise<FirebaseTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Firebase ID token: not a JWT');
  }

  const [headerB64, payloadB64, sigB64] = parts;

  // Decode header to get kid
  const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
  const header = JSON.parse(headerJson) as { alg: string; kid: string };

  if (header.alg !== 'RS256') {
    throw new Error(`Invalid Firebase ID token: expected RS256, got ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error('Invalid Firebase ID token: missing kid in header');
  }

  // Fetch public key
  const publicKey = await getPublicKey(header.kid);

  // Verify signature
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlDecode(sigB64);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signatureBytes.buffer as ArrayBuffer,
    signingInput.buffer as ArrayBuffer
  );
  if (!valid) {
    throw new Error('Invalid Firebase ID token: signature verification failed');
  }

  // Decode payload
  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = JSON.parse(payloadJson) as FirebaseTokenPayload;

  // Validate standard claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Firebase ID token has expired');
  }

  const expectedIss = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIss) {
    throw new Error(`Invalid Firebase ID token: wrong issuer (got ${payload.iss})`);
  }

  if (payload.aud !== projectId) {
    throw new Error(`Invalid Firebase ID token: wrong audience (got ${payload.aud})`);
  }

  if (!payload.sub) {
    throw new Error('Invalid Firebase ID token: missing sub');
  }

  // uid is the same as sub in Firebase tokens
  payload.uid = payload.sub;

  return payload;
}
