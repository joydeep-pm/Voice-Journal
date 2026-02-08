import * as SQLite from 'expo-sqlite';
import { runMigrations } from '@/src/db/schema';

const DB_NAME = 'voice_journal_app.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return dbPromise;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await openDb();
  await initDb();
  return db;
}

export async function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await openDb();
      await runMigrations(db);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}
