import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

// Local default: a SQLite file under ./data. For cloud deploys set
// SYNC_DB_URL (libsql://... from Turso) and SYNC_DB_AUTH_TOKEN.
const DEFAULT_URL = "file:data/daybreak-sync.db";

let clientPromise: Promise<Client> | null = null;

async function init(): Promise<Client> {
  const url = process.env.SYNC_DB_URL ?? DEFAULT_URL;
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const client = createClient({
    url,
    authToken: process.env.SYNC_DB_AUTH_TOKEN,
  });
  await client.execute(
    `CREATE TABLE IF NOT EXISTS sync_blobs (
       id TEXT PRIMARY KEY,
       version INTEGER NOT NULL,
       data TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  );
  return client;
}

export function getDb(): Promise<Client> {
  clientPromise ??= init();
  return clientPromise;
}
