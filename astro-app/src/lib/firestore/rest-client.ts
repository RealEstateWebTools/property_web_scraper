/**
 * REST-based Firestore client using fetch() (CF Workers compatible).
 * No third-party SDK — uses the Firestore REST API directly.
 */

import type {
  DocData,
  FirestoreClient,
  FirestoreCollectionReference,
  FirestoreDocumentReference,
  FirestoreDocumentSnapshot,
  FirestoreQuery,
  FirestoreQuerySnapshot,
} from './types.js';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

// --- JWT Auth ---

let cachedToken: { token: string; expiry: number } | null = null;

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textToBase64Url(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function getAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiry > now + 60) {
    return cachedToken.token;
  }

  const header = textToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = textToBase64Url(
    JSON.stringify({
      iss: creds.client_email,
      sub: creds.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore',
    })
  );

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(creds.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OAuth token exchange failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiry: now + data.expires_in };
  return data.access_token;
}

/** Clear cached token (for testing) */
export function resetTokenCache(): void {
  cachedToken = null;
}

// --- Value Conversion ---

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { timestampValue: string };

export function jsToFirestore(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsToFirestore) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = jsToFirestore(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function firestoreToJs(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(firestoreToJs);
  }
  if ('mapValue' in value) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      result[k] = firestoreToJs(v);
    }
    return result;
  }
  return null;
}

function docDataToFields(data: DocData): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = jsToFirestore(v);
  }
  return fields;
}

function fieldsToDocData(fields: Record<string, FirestoreValue>): DocData {
  const data: DocData = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = firestoreToJs(v);
  }
  return data;
}

function extractDocId(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

// --- REST Document Snapshot ---

class RestDocumentSnapshot implements FirestoreDocumentSnapshot {
  constructor(
    private _collectionName: string,
    public readonly id: string,
    private _data: DocData | undefined,
    private _baseUrl: string,
    private _creds: ServiceAccountCredentials
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): DocData | undefined {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }

  get ref(): FirestoreDocumentReference {
    return new RestDocumentReference(this._collectionName, this.id, this._baseUrl, this._creds);
  }
}

// --- REST Document Reference ---

class RestDocumentReference implements FirestoreDocumentReference {
  constructor(
    private _collectionName: string,
    public readonly id: string,
    private _baseUrl: string,
    private _creds: ServiceAccountCredentials
  ) {}

  private get docUrl(): string {
    return `${this._baseUrl}/${this._collectionName}/${this.id}`;
  }

  async get(): Promise<FirestoreDocumentSnapshot> {
    const token = await getAccessToken(this._creds);
    const resp = await fetch(this.docUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 404) {
      return new RestDocumentSnapshot(this._collectionName, this.id, undefined, this._baseUrl, this._creds);
    }
    if (!resp.ok) {
      throw new Error(`Firestore GET failed (${resp.status}): ${await resp.text()}`);
    }

    const body = (await resp.json()) as { fields?: Record<string, FirestoreValue> };
    const data = body.fields ? fieldsToDocData(body.fields) : {};
    return new RestDocumentSnapshot(this._collectionName, this.id, data, this._baseUrl, this._creds);
  }

  async set(data: DocData): Promise<void> {
    const token = await getAccessToken(this._creds);
    const resp = await fetch(this.docUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: docDataToFields(data) }),
    });

    if (!resp.ok) {
      throw new Error(`Firestore SET failed (${resp.status}): ${await resp.text()}`);
    }
  }

  async update(data: DocData): Promise<void> {
    const token = await getAccessToken(this._creds);
    const fields = docDataToFields(data);
    const fieldPaths = Object.keys(data).map((k) => `updateMask.fieldPaths=${k}`).join('&');
    const resp = await fetch(`${this.docUrl}?${fieldPaths}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!resp.ok) {
      throw new Error(`Firestore UPDATE failed (${resp.status}): ${await resp.text()}`);
    }
  }

  async delete(): Promise<void> {
    const token = await getAccessToken(this._creds);
    const resp = await fetch(this.docUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      throw new Error(`Firestore DELETE failed (${resp.status}): ${await resp.text()}`);
    }
  }
}

// --- REST Query ---

interface QueryCondition {
  field: string;
  op: string;
  value: unknown;
}

class RestQuery implements FirestoreQuery {
  constructor(
    private _collectionName: string,
    private _conditions: QueryCondition[],
    private _baseUrl: string,
    private _creds: ServiceAccountCredentials
  ) {}

  where(field: string, op: string, value: unknown): FirestoreQuery {
    return new RestQuery(
      this._collectionName,
      [...this._conditions, { field, op, value }],
      this._baseUrl,
      this._creds
    );
  }

  async get(): Promise<FirestoreQuerySnapshot> {
    const token = await getAccessToken(this._creds);
    const parentUrl = this._baseUrl;

    const filters = this._conditions.map((c) => ({
      fieldFilter: {
        field: { fieldPath: c.field },
        op: c.op === '==' ? 'EQUAL' : 'EQUAL',
        value: jsToFirestore(c.value),
      },
    }));

    const where =
      filters.length === 1
        ? { fieldFilter: filters[0].fieldFilter }
        : filters.length > 1
          ? { compositeFilter: { op: 'AND', filters } }
          : undefined;

    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: this._collectionName }],
    };
    if (where) structuredQuery.where = where;

    const resp = await fetch(`${parentUrl}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    });

    if (!resp.ok) {
      throw new Error(`Firestore QUERY failed (${resp.status}): ${await resp.text()}`);
    }

    const results = (await resp.json()) as Array<{
      document?: { name: string; fields?: Record<string, FirestoreValue> };
    }>;

    const docs: FirestoreDocumentSnapshot[] = [];
    for (const result of results) {
      if (!result.document) continue;
      const docId = extractDocId(result.document.name);
      const data = result.document.fields ? fieldsToDocData(result.document.fields) : {};
      docs.push(new RestDocumentSnapshot(this._collectionName, docId, data, this._baseUrl, this._creds));
    }

    return { docs, empty: docs.length === 0 };
  }
}

// --- REST Collection Reference ---

let restIdCounter = 0;

class RestCollectionReference implements FirestoreCollectionReference {
  constructor(
    private _name: string,
    private _baseUrl: string,
    private _creds: ServiceAccountCredentials
  ) {}

  doc(id?: string): FirestoreDocumentReference {
    const docId = id || `auto_${Date.now()}_${++restIdCounter}`;
    return new RestDocumentReference(this._name, docId, this._baseUrl, this._creds);
  }

  where(field: string, op: string, value: unknown): FirestoreQuery {
    return new RestQuery(this._name, [{ field, op, value }], this._baseUrl, this._creds);
  }

  async listDocuments(): Promise<FirestoreDocumentReference[]> {
    const token = await getAccessToken(this._creds);
    const resp = await fetch(`${this._baseUrl}/${this._name}?pageSize=100&showMissing=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      throw new Error(`Firestore LIST failed (${resp.status}): ${await resp.text()}`);
    }

    const body = (await resp.json()) as { documents?: Array<{ name: string }> };
    return (body.documents || []).map((doc) => {
      const docId = extractDocId(doc.name);
      return new RestDocumentReference(this._name, docId, this._baseUrl, this._creds);
    });
  }

  async get(): Promise<FirestoreQuerySnapshot> {
    return new RestQuery(this._name, [], this._baseUrl, this._creds).get();
  }
}

// --- REST Firestore Client ---

export class RestFirestoreClient implements FirestoreClient {
  private _baseUrl: string;
  private _creds: ServiceAccountCredentials;

  constructor(creds: ServiceAccountCredentials) {
    this._creds = creds;
    this._baseUrl = `https://firestore.googleapis.com/v1/projects/${creds.project_id}/databases/(default)/documents`;
  }

  get projectId(): string {
    return this._creds.project_id;
  }

  collection(name: string): FirestoreCollectionReference {
    return new RestCollectionReference(name, this._baseUrl, this._creds);
  }

  col(name: string): FirestoreCollectionReference {
    return this.collection(name);
  }

  async transaction<T>(fn: (tx: FirestoreClient) => Promise<T>): Promise<T> {
    // Simple pass-through — no real transaction support in REST mode.
    // The ORM only uses transactions for simple read-modify-write patterns.
    return fn(this);
  }

  /** Lightweight connectivity test — attempts to list root collections. */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const token = await getAccessToken(this._creds);
      const resp = await fetch(`${this._baseUrl}?pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) return { ok: true };
      const body = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function parseServiceAccountJson(json: string): ServiceAccountCredentials {
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('Invalid service account JSON: missing client_email, private_key, or project_id');
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    project_id: parsed.project_id,
  };
}
