/**
 * Typed interfaces for the Firestore client contract.
 * Both InMemoryFirestoreClient and RestFirestoreClient implement these.
 */

export type DocData = Record<string, unknown>;

export interface FirestoreDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): DocData | undefined;
  readonly ref: FirestoreDocumentReference;
}

export interface FirestoreDocumentReference {
  readonly id: string;
  get(): Promise<FirestoreDocumentSnapshot>;
  set(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
}

export interface FirestoreQuerySnapshot {
  readonly docs: FirestoreDocumentSnapshot[];
  readonly empty: boolean;
}

export interface FirestoreQuery {
  where(field: string, op: string, value: unknown): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
}

export interface FirestoreCollectionReference extends FirestoreQuery {
  doc(id?: string): FirestoreDocumentReference;
  where(field: string, op: string, value: unknown): FirestoreQuery;
  listDocuments(): Promise<FirestoreDocumentReference[]>;
}

export interface FirestoreClient {
  collection(name: string): FirestoreCollectionReference;
  col(name: string): FirestoreCollectionReference;
  transaction<T>(fn: (tx: FirestoreClient) => Promise<T>): Promise<T>;
}

export type StorageBackendType = 'in_memory' | 'firestore_rest';

export interface StorageStatus {
  backend: StorageBackendType;
  connected: boolean;
  projectId: string | null;
  error: string | null;
}
