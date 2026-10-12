import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { config, initializeDatabase } from '@skillright/backend';

export function openRegistry(): Database.Database {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  return initializeDatabase(config.dbPath);
}

export function withDb<T>(fn: (db: Database.Database) => T): T {
  const db = openRegistry();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export async function withDbAsync<T>(fn: (db: Database.Database) => Promise<T>): Promise<T> {
  const db = openRegistry();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}
