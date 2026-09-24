import { MongoClient, type Document } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type Row = { id: string; [key: string]: unknown };
export interface Store {
  get<T>(collection: string, id: string): Promise<T | null>;
  list<T>(collection: string, filter?: Record<string, unknown>): Promise<T[]>;
  insert(collection: string, row: { id: string }): Promise<boolean>;
  put(collection: string, row: { id: string }, expectedRevision?: number): Promise<boolean>;
  remove(collection: string, id: string): Promise<void>;
  close(): Promise<void>;
}
export class FileStore implements Store {
  private data: Record<string, Record<string, unknown>> = {};
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private filename: string) {}
  async init() {
    try {
      this.data = JSON.parse(await readFile(this.filename, 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    return this;
  }
  async get<T>(collection: string, id: string) {
    await this.tail;
    return structuredClone(this.data[collection]?.[id] ?? null) as T | null;
  }
  async list<T>(collection: string, filter: Record<string, unknown> = {}) {
    await this.tail;
    return structuredClone(
      Object.values(this.data[collection] ?? {}).filter((row) =>
        Object.entries(filter).every(([k, v]) => (row as Row)[k] === v),
      ),
    ) as T[];
  }
  private mutate<T>(fn: () => T): Promise<T> {
    const operation = this.tail.then(async () => {
      const before = structuredClone(this.data);
      try {
        const value = fn();
        await mkdir(path.dirname(this.filename), { recursive: true });
        const tmp = `${this.filename}.${randomUUID()}.tmp`;
        await writeFile(tmp, JSON.stringify(this.data), { mode: 0o600 });
        await rename(tmp, this.filename);
        return value;
      } catch (error) {
        this.data = before;
        throw error;
      }
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }
  async insert(collection: string, row: { id: string }) {
    return this.mutate(() => {
      this.data[collection] ??= {};
      if (this.data[collection][row.id]) return false;
      this.data[collection][row.id] = structuredClone(row);
      return true;
    });
  }
  async put(collection: string, row: { id: string }, expectedRevision?: number) {
    return this.mutate(() => {
      this.data[collection] ??= {};
      const previous = this.data[collection][row.id] as Row | undefined;
      if (expectedRevision !== undefined && previous?.revision !== expectedRevision) return false;
      this.data[collection][row.id] = structuredClone(row);
      return true;
    });
  }
  async remove(collection: string, id: string) {
    await this.mutate(() => {
      delete this.data[collection]?.[id];
    });
  }
  async close() {
    await this.tail;
  }
}
export async function createStore(): Promise<Store> {
  if (!process.env.MONGODB_URI) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('MONGODB_URI is required in production. File storage is development-only.');
    console.info('Development storage: .data/studio.json (configure MongoDB for production)');
    return new FileStore(path.resolve('.data/studio.json')).init();
  }
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || 'trao_interview_studio');
  await Promise.all(
    ['users', 'sessions', 'kits', 'jobs'].map((c) =>
      db.collection(c).createIndex({ id: 1 }, { unique: true }),
    ),
  );
  await Promise.all(
    ['kits', 'jobs'].map((c) => db.collection(c).createIndex({ owner: 1, created_at: -1 })),
  );
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return {
    async get<T>(c: string, id: string) {
      return (await db.collection(c).findOne({ id }, { projection: { _id: 0 } })) as T | null;
    },
    async list<T>(c: string, filter = {}) {
      return (await db
        .collection(c)
        .find(filter, { projection: { _id: 0 } })
        .toArray()) as T[];
    },
    async insert(c, row) {
      try {
        await db.collection(c).insertOne(row as Document);
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async put(c, row, revision) {
      const result = await db
        .collection(c)
        .replaceOne({ id: row.id, ...(revision !== undefined ? { revision } : {}) }, row, {
          upsert: revision === undefined,
        });
      return result.modifiedCount === 1 || result.upsertedCount === 1;
    },
    async remove(c, id) {
      await db.collection(c).deleteOne({ id });
    },
    async close() {
      await client.close();
    },
  };
}
