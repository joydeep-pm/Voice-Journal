import * as SQLite from 'expo-sqlite';

const DB_NAME = 'voice_journal.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function migrationV1(): string {
  return `
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audio_uri TEXT NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      transcript TEXT,
      summary TEXT,
      title TEXT,
      mood TEXT,
      ai_status TEXT NOT NULL DEFAULT 'idle',
      ai_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag_id),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id);
  `;
}

function migrationV2(): string {
  return `
    CREATE TABLE IF NOT EXISTS ai_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('transcribe', 'summarize')),
      status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'done', 'failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON ai_jobs(status, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_unique_active
      ON ai_jobs(entry_id, kind)
      WHERE status IN ('queued', 'processing');
  `;
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(migrationV1());
    await db.execAsync('PRAGMA user_version = 1;');
    version = 1;
  }

  if (version < 2) {
    await db.execAsync(migrationV2());
    await db.execAsync('PRAGMA user_version = 2;');
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await runMigrations(db);
      return db;
    })();
  }

  return dbPromise;
}

export async function resetDbForDevOnly() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM ai_jobs;
    DELETE FROM entry_tags;
    DELETE FROM tags;
    DELETE FROM entries;
  `);
}
