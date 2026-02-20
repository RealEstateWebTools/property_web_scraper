import { getClient, getCollectionPrefix } from './client.js';
import type {
  FirestoreCollectionReference,
  FirestoreDocumentSnapshot,
  FirestoreQuery,
} from './types.js';

export interface AttributeDefinition {
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'array' | 'hash';
  default?: unknown;
}

/**
 * Base model class providing an ActiveRecord-like API backed by Firestore.
 * Port of Ruby FirestoreModel.
 */
export abstract class BaseModel {
  id: string = '';
  private _persisted = false;

  static _collectionName: string = '';
  static _documentIdField: string | null = null;
  static _attributeDefinitions: Record<string, AttributeDefinition> = {};

  get persisted(): boolean {
    return this._persisted;
  }

  static async collectionRef() {
    const prefix = getCollectionPrefix();
    const db = await getClient();
    return db.collection(`${prefix}${this._collectionName}`);
  }

  static async find<T extends BaseModel>(this: ModelConstructor<T>, id: string): Promise<T> {
    const col = await this.collectionRef();
    const doc = await col.doc(id).get();
    if (!doc.exists) throw new Error(`Document not found: ${id}`);
    return this.buildFromSnapshot(doc);
  }

  static async findBy<T extends BaseModel>(
    this: ModelConstructor<T>,
    conditions: Record<string, unknown>
  ): Promise<T | null> {
    let query: FirestoreQuery = await this.collectionRef();
    for (const [field, value] of Object.entries(conditions)) {
      query = query.where(field, '==', value);
    }
    const snapshot = await query.get();
    if (snapshot.empty) return null;
    return this.buildFromSnapshot(snapshot.docs[0]);
  }

  static async where<T extends BaseModel>(
    this: ModelConstructor<T>,
    conditions: Record<string, unknown>
  ): Promise<WhereChain<T>> {
    return new WhereChain(this, conditions);
  }

  static async create<T extends BaseModel>(
    this: ModelConstructor<T>,
    attrs: Record<string, unknown> = {}
  ): Promise<T> {
    const instance = new this();
    instance.assignAttributes(attrs);
    await instance.save();
    return instance;
  }

  static buildFromSnapshot<T extends BaseModel>(
    this: ModelConstructor<T>,
    doc: FirestoreDocumentSnapshot
  ): T {
    const instance = new this();
    instance.id = doc.id;
    const data = doc.data() || {};
    instance.assignAttributesFromFirestore(data);
    instance._persisted = true;
    return instance;
  }

  assignAttributes(attrs: Record<string, unknown>): void {
    const defs = (this.constructor as typeof BaseModel)._attributeDefinitions;
    for (const [key, value] of Object.entries(attrs)) {
      if (key in defs) {
        (this as Record<string, unknown>)[key] = this.castValue(value, defs[key].type);
      }
    }
  }

  assignAttributesFromFirestore(data: Record<string, unknown>): void {
    const defs = (this.constructor as typeof BaseModel)._attributeDefinitions;
    for (const [name, defn] of Object.entries(defs)) {
      const raw = name in data ? data[name] : defn.default;
      (this as Record<string, unknown>)[name] = this.castValue(raw, defn.type);
    }
  }

  async save(): Promise<this> {
    const ctor = this.constructor as typeof BaseModel;
    const data = this.firestoreAttributes();
    const col = await ctor.collectionRef();

    if (this._persisted) {
      await col.doc(this.id).set(data);
    } else {
      if (ctor._documentIdField) {
        const docId = String((this as Record<string, unknown>)[ctor._documentIdField]);
        this.id = docId;
        await col.doc(docId).set(data);
      } else {
        // Use existing id if already set (e.g. stable ID from extraction-runner),
        // otherwise let Firestore auto-generate one.
        const docRef = this.id ? col.doc(this.id) : col.doc();
        this.id = docRef.id;
        await docRef.set(data);
      }
      this._persisted = true;
    }
    return this;
  }

  async destroy(): Promise<void> {
    if (!this._persisted) return;
    const ctor = this.constructor as typeof BaseModel;
    const col = await ctor.collectionRef();
    await col.doc(this.id).delete();
    this._persisted = false;
  }

  firestoreAttributes(): Record<string, unknown> {
    const defs = (this.constructor as typeof BaseModel)._attributeDefinitions;
    const attrs: Record<string, unknown> = {};
    for (const name of Object.keys(defs)) {
      attrs[name] = (this as Record<string, unknown>)[name];
    }
    return attrs;
  }

  asJson(only?: string[]): Record<string, unknown> {
    const attrs = this.firestoreAttributes();
    if (!only) return attrs;
    const result: Record<string, unknown> = {};
    for (const key of only) {
      if (key in attrs) result[key] = attrs[key];
    }
    return result;
  }

  private castValue(value: unknown, type: string): unknown {
    if (value == null) return value;
    switch (type) {
      case 'string':
        return String(value);
      case 'integer':
        return typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10) || 0;
      case 'float':
        return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      case 'boolean':
        return !!value;
      case 'datetime':
        return value instanceof Date ? value : typeof value === 'string' ? new Date(value) : value;
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'hash':
        return typeof value === 'object' && !Array.isArray(value) ? value : {};
      default:
        return value;
    }
  }
}

type ModelConstructor<T extends BaseModel> = {
  new (): T;
  _collectionName: string;
  _documentIdField: string | null;
  _attributeDefinitions: Record<string, AttributeDefinition>;
  collectionRef(): Promise<FirestoreCollectionReference>;
  buildFromSnapshot(doc: FirestoreDocumentSnapshot): T;
};

/**
 * Chainable query builder.
 * Port of Ruby WhereChain.
 */
export class WhereChain<T extends BaseModel> {
  constructor(
    private klass: ModelConstructor<T>,
    private conditions: Record<string, unknown>
  ) {}

  async first(): Promise<T | null> {
    let query: FirestoreQuery = await this.klass.collectionRef();
    for (const [field, value] of Object.entries(this.conditions)) {
      query = query.where(field, '==', value);
    }
    const snapshot = await query.get();
    if (snapshot.empty) return null;
    return this.klass.buildFromSnapshot(snapshot.docs[0]);
  }

  async firstOrCreate(attrs: Record<string, unknown> = {}): Promise<T> {
    const existing = await this.first();
    if (existing) return existing;
    const instance = new this.klass();
    instance.assignAttributes({ ...this.conditions, ...attrs });
    await instance.save();
    return instance;
  }

  async get(): Promise<T[]> {
    let query: FirestoreQuery = await this.klass.collectionRef();
    for (const [field, value] of Object.entries(this.conditions)) {
      query = query.where(field, '==', value);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.klass.buildFromSnapshot(doc));
  }
}
