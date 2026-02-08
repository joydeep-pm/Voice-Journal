import type * as SQLite from 'expo-sqlite';

type Migration = {
  version: number;
  statements: string[];
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        audio_uri TEXT NOT NULL,
        duration_sec INTEGER NOT NULL,
        transcript TEXT,
        summary TEXT,
        mood TEXT,
        ai_status TEXT NOT NULL DEFAULT 'none' CHECK(ai_status IN ('none', 'queued', 'transcribed', 'summarized', 'error')),
        error_msg TEXT
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS ai_jobs (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('transcribe', 'summarize')),
        status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'done', 'error')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );
      `,
      'CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON ai_jobs(status, created_at);',
    ],
  },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
