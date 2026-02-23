import { Db, MongoClient } from "mongodb";

type GlobalMongoCache = {
  client: MongoClient;
  clientPromise: Promise<MongoClient>;
};

const globalForMongo = globalThis as typeof globalThis & {
  __mongoCache?: GlobalMongoCache;
};

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  return uri;
}

function extractDbName(connectionUri: string): string {
  try {
    const parsed = new URL(connectionUri);
    const dbName = parsed.pathname.replace("/", "").trim();
    return dbName || "unispot";
  } catch {
    const match = connectionUri.match(/^[^/]+\/\/[^/]+\/([^?]+)/);
    return match?.[1]?.trim() || "unispot";
  }
}

function getOrCreateCache(): GlobalMongoCache {
  const existingCache = globalForMongo.__mongoCache;
  if (existingCache) {
    return existingCache;
  }

  const uri = getMongoUri();
  const client = new MongoClient(uri);
  const newCache: GlobalMongoCache = {
    client,
    clientPromise: client.connect(),
  };

  if (process.env.NODE_ENV !== "production") {
    globalForMongo.__mongoCache = newCache;
  }

  return newCache;
}

export function getClient(): Promise<MongoClient> {
  return getOrCreateCache().clientPromise;
}

export function getDb(): Db {
  const uri = getMongoUri();
  const dbName = extractDbName(uri);
  return getOrCreateCache().client.db(dbName);
}
