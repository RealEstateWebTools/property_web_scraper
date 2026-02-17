import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  jsToFirestore,
  firestoreToJs,
  RestFirestoreClient,
  parseServiceAccountJson,
  resetTokenCache,
} from '../../src/lib/firestore/rest-client.js';

describe('REST Client', () => {
  describe('jsToFirestore', () => {
    it('converts strings', () => {
      expect(jsToFirestore('hello')).toEqual({ stringValue: 'hello' });
    });

    it('converts integers', () => {
      expect(jsToFirestore(42)).toEqual({ integerValue: '42' });
    });

    it('converts floats', () => {
      expect(jsToFirestore(3.14)).toEqual({ doubleValue: 3.14 });
    });

    it('converts booleans', () => {
      expect(jsToFirestore(true)).toEqual({ booleanValue: true });
      expect(jsToFirestore(false)).toEqual({ booleanValue: false });
    });

    it('converts null', () => {
      expect(jsToFirestore(null)).toEqual({ nullValue: null });
    });

    it('converts undefined', () => {
      expect(jsToFirestore(undefined)).toEqual({ nullValue: null });
    });

    it('converts arrays', () => {
      expect(jsToFirestore(['a', 1])).toEqual({
        arrayValue: {
          values: [
            { stringValue: 'a' },
            { integerValue: '1' },
          ],
        },
      });
    });

    it('converts objects', () => {
      expect(jsToFirestore({ key: 'value' })).toEqual({
        mapValue: {
          fields: {
            key: { stringValue: 'value' },
          },
        },
      });
    });

    it('converts dates', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(jsToFirestore(date)).toEqual({
        timestampValue: '2024-01-01T00:00:00.000Z',
      });
    });

    it('converts empty arrays', () => {
      expect(jsToFirestore([])).toEqual({ arrayValue: { values: [] } });
    });

    it('converts nested objects', () => {
      const input = { a: { b: 'c' } };
      const result = jsToFirestore(input);
      expect(result).toEqual({
        mapValue: {
          fields: {
            a: {
              mapValue: {
                fields: {
                  b: { stringValue: 'c' },
                },
              },
            },
          },
        },
      });
    });
  });

  describe('firestoreToJs', () => {
    it('converts stringValue', () => {
      expect(firestoreToJs({ stringValue: 'hello' })).toBe('hello');
    });

    it('converts integerValue', () => {
      expect(firestoreToJs({ integerValue: '42' })).toBe(42);
    });

    it('converts doubleValue', () => {
      expect(firestoreToJs({ doubleValue: 3.14 })).toBe(3.14);
    });

    it('converts booleanValue', () => {
      expect(firestoreToJs({ booleanValue: true })).toBe(true);
    });

    it('converts nullValue', () => {
      expect(firestoreToJs({ nullValue: null })).toBe(null);
    });

    it('converts arrayValue', () => {
      expect(firestoreToJs({
        arrayValue: { values: [{ stringValue: 'a' }, { integerValue: '1' }] },
      })).toEqual(['a', 1]);
    });

    it('converts mapValue', () => {
      expect(firestoreToJs({
        mapValue: { fields: { key: { stringValue: 'value' } } },
      })).toEqual({ key: 'value' });
    });

    it('converts timestampValue', () => {
      const result = firestoreToJs({ timestampValue: '2024-01-01T00:00:00.000Z' });
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles empty arrayValue', () => {
      expect(firestoreToJs({ arrayValue: {} })).toEqual([]);
    });

    it('handles empty mapValue', () => {
      expect(firestoreToJs({ mapValue: {} })).toEqual({});
    });
  });

  describe('parseServiceAccountJson', () => {
    it('parses valid service account JSON', () => {
      const json = JSON.stringify({
        client_email: 'test@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
        project_id: 'test-project',
      });
      const creds = parseServiceAccountJson(json);
      expect(creds.client_email).toBe('test@project.iam.gserviceaccount.com');
      expect(creds.project_id).toBe('test-project');
    });

    it('throws on missing fields', () => {
      expect(() => parseServiceAccountJson('{}')).toThrow('Invalid service account JSON');
    });

    it('throws on invalid JSON', () => {
      expect(() => parseServiceAccountJson('not json')).toThrow();
    });
  });

  describe('RestFirestoreClient', () => {
    const fakeCreds = {
      client_email: 'test@project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
      project_id: 'test-project',
    };

    it('exposes projectId', () => {
      const client = new RestFirestoreClient(fakeCreds);
      expect(client.projectId).toBe('test-project');
    });

    it('creates collection references', () => {
      const client = new RestFirestoreClient(fakeCreds);
      const col = client.collection('test');
      expect(col).toBeTruthy();
      expect(typeof col.doc).toBe('function');
      expect(typeof col.where).toBe('function');
    });

    it('col() is an alias for collection()', () => {
      const client = new RestFirestoreClient(fakeCreds);
      const col1 = client.collection('test');
      const col2 = client.col('test');
      // Both should work — different instances but same API
      expect(typeof col1.doc).toBe('function');
      expect(typeof col2.doc).toBe('function');
    });

    it('transaction passes through', async () => {
      const client = new RestFirestoreClient(fakeCreds);
      const result = await client.transaction(async (tx) => {
        return 'done';
      });
      expect(result).toBe('done');
    });

    describe('healthCheck with mocked fetch', () => {
      const originalFetch = globalThis.fetch;

      afterEach(() => {
        globalThis.fetch = originalFetch;
        resetTokenCache();
      });

      it('returns ok:false when auth or fetch fails', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
        const client = new RestFirestoreClient(fakeCreds);
        const result = await client.healthCheck();
        expect(result.ok).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('value conversion roundtrip', () => {
    it('preserves string through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore('hello'))).toBe('hello');
    });

    it('preserves integer through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore(42))).toBe(42);
    });

    it('preserves boolean through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore(true))).toBe(true);
    });

    it('preserves null through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore(null))).toBe(null);
    });

    it('preserves array through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore([1, 'two', true]))).toEqual([1, 'two', true]);
    });

    it('preserves object through roundtrip', () => {
      expect(firestoreToJs(jsToFirestore({ a: 1, b: 'two' }))).toEqual({ a: 1, b: 'two' });
    });
  });
});
