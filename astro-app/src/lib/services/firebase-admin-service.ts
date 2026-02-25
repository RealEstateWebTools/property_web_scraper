/**
 * Firebase Admin Service
 * Connects to Firebase using the Google Service Account for admin operations.
 * Uses Google Identity and Access Management (IAM) service account token.
 */

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid OAuth 2.0 access token using the service account private key.
 */
async function getServiceAccountToken(): Promise<string> {
  // Check cache
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  let credentialsJson: string | undefined;

  try {
    // Try import.meta.env first (Astro)
    const env = import.meta.env as Record<string, any>;
    credentialsJson = env?.GOOGLE_SERVICE_ACCOUNT_JSON;

    // Fallback to process.env (Node.js)
    if (!credentialsJson && typeof process !== 'undefined') {
      credentialsJson = process.env?.GOOGLE_SERVICE_ACCOUNT_JSON;
    }

    if (!credentialsJson) {
      throw new Error('Service account credentials not configured');
    }

    const credentials: ServiceAccount = JSON.parse(credentialsJson);

    // Create JWT for token exchange
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit',
      aud: credentials.token_uri,
      exp: now + 3600,
      iat: now,
    };

    const headerEncoded = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadEncoded = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    // Sign the JWT
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureInput);
    const keyData = await crypto.subtle.importKey(
      'pkcs8',
      pem2der(credentials.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyData, data);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureEncoded = btoa(String.fromCharCode(...signatureArray))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch(credentials.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    const tokenData = (await tokenResponse.json()) as { access_token: string; expires_in: number };
    const token = tokenData.access_token;
    const expiresAt = Date.now() + (tokenData.expires_in - 60) * 1000;

    cachedToken = { token, expiresAt };
    return token;
  } catch (err) {
    console.error('[Firebase] Token generation failed:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Convert PEM to DER format for crypto.subtle.importKey
 */
function pem2der(pem: string): ArrayBuffer {
  const lines = pem.split('\n');
  let base64 = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && line[0] !== '-') {
      base64 += line;
    }
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Initialize Firebase (dummy function for compatibility)
 */
export function initializeFirebaseAdmin(): void {
  // Firebase initialization happens lazily when needed
}

/**
 * List all users from Firebase Authentication using REST API.
 * Falls back gracefully if service account is not configured.
 */
export async function listFirebaseUsers(): Promise<
  Array<{
    uid: string;
    email?: string;
    displayName?: string;
    disabled: boolean;
    createdAt?: string;
  }>
> {
  try {
    const projectId = (import.meta.env as any)?.FIRESTORE_PROJECT_ID || process.env?.FIRESTORE_PROJECT_ID;
    if (!projectId) {
      console.warn('[Firebase] Project ID not configured');
      return [];
    }

    const token = await getServiceAccountToken();

    // Use Google Identity Toolkit REST API to list users
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Firebase] Batch get failed: ${response.status} - ${errorText}`);
      return [];
    }

    const data = (await response.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        displayName?: string;
        disabled?: boolean;
        createdAt?: number;
      }>;
    };

    return (data.users || []).map((user) => ({
      uid: user.localId,
      email: user.email,
      displayName: user.displayName,
      disabled: user.disabled || false,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
    }));
  } catch (err) {
    console.warn('[Firebase] listFirebaseUsers failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}
