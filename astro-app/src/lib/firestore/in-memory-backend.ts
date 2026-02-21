/**
 * In-memory Firestore backend for tests.
 * Port of Ruby InMemoryFirestore module.
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

const store: Map<string, Map<string, DocData>> = new Map();

export function resetStore(): void {
  store.clear();
}

/** Clear one or more named collections while leaving others intact. */
export function clearCollections(...names: string[]): void {
  for (const name of names) {
    if (store.has(name)) {
      store.get(name)!.clear();
    }
  }
}

function getCollection(name: string): Map<string, DocData> {
  if (!store.has(name)) {
    store.set(name, new Map());
  }
  return store.get(name)!;
}

function deepCopy(obj: DocData): DocData {
  return JSON.parse(JSON.stringify(obj));
}

let idCounter = 0;
function generateId(): string {
  return `auto_${++idCounter}`;
}

// DocumentSnapshot
class InMemoryDocumentSnapshot implements FirestoreDocumentSnapshot {
  constructor(
    private collectionName: string,
    public readonly id: string,
    private _data: DocData | undefined
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): DocData | undefined {
    return this._data ? deepCopy(this._data) : undefined;
  }

  get ref(): InMemoryDocumentReference {
    return new InMemoryDocumentReference(this.collectionName, this.id);
  }
}

// DocumentReference
class InMemoryDocumentReference implements FirestoreDocumentReference {
  constructor(
    private collectionName: string,
    public readonly id: string
  ) {}

  async get(): Promise<InMemoryDocumentSnapshot> {
    const col = getCollection(this.collectionName);
    const data = col.get(this.id);
    return new InMemoryDocumentSnapshot(this.collectionName, this.id, data);
  }

  async set(data: DocData): Promise<void> {
    const col = getCollection(this.collectionName);
    col.set(this.id, deepCopy(data));
  }

  async update(data: DocData): Promise<void> {
    const col = getCollection(this.collectionName);
    const existing = col.get(this.id) || {};
    col.set(this.id, { ...existing, ...deepCopy(data) });
  }

  async delete(): Promise<void> {
    const col = getCollection(this.collectionName);
    col.delete(this.id);
  }
}

// QuerySnapshot
class InMemoryQuerySnapshot implements FirestoreQuerySnapshot {
  constructor(public readonly docs: InMemoryDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }
}

// Query
class InMemoryQuery implements FirestoreQuery {
  constructor(
    private collectionName: string,
    private conditions: Array<[string, string, unknown]>
  ) {}

  where(field: string, op: string, value: unknown): InMemoryQuery {
    return new InMemoryQuery(this.collectionName, [...this.conditions, [field, op, value]]);
  }

  async get(): Promise<InMemoryQuerySnapshot> {
    const col = getCollection(this.collectionName);
    const results: InMemoryDocumentSnapshot[] = [];

    for (const [id, data] of col.entries()) {
      const matches = this.conditions.every(([field, _op, value]) => {
        return data[field] === value;
      });
      if (matches) {
        results.push(new InMemoryDocumentSnapshot(this.collectionName, id, data));
      }
    }
    return new InMemoryQuerySnapshot(results);
  }
}

// CollectionReference
class InMemoryCollectionReference implements FirestoreCollectionReference {
  constructor(private name: string) {}

  doc(id?: string): InMemoryDocumentReference {
    const docId = id || generateId();
    return new InMemoryDocumentReference(this.name, docId);
  }

  where(field: string, op: string, value: unknown): InMemoryQuery {
    return new InMemoryQuery(this.name, [[field, op, value]]);
  }

  async get(): Promise<InMemoryQuerySnapshot> {
    return new InMemoryQuery(this.name, []).get();
  }

  async listDocuments(): Promise<InMemoryDocumentReference[]> {
    const col = getCollection(this.name);
    return Array.from(col.keys()).map(
      (id) => new InMemoryDocumentReference(this.name, id)
    );
  }
}

// Client
export class InMemoryFirestoreClient implements FirestoreClient {
  collection(name: string): InMemoryCollectionReference {
    return new InMemoryCollectionReference(name);
  }

  // Alias to match the Google SDK API
  col(name: string): InMemoryCollectionReference {
    return this.collection(name);
  }

  async transaction<T>(fn: (tx: FirestoreClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}
