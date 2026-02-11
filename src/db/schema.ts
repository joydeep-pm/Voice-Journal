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
  {
    version: 2,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        entry_id TEXT,
        created_at INTEGER NOT NULL,
        stress_intensity INTEGER NOT NULL CHECK(stress_intensity >= 0 AND stress_intensity <= 10),
        trigger_tags TEXT,
        recommended_tool TEXT NOT NULL CHECK(recommended_tool IN ('breathing', 'grounding', 'reframe')),
        note TEXT,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE SET NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS intervention_sessions (
        id TEXT PRIMARY KEY,
        checkin_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('breathing', 'grounding', 'reframe')),
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        relief_delta INTEGER,
        details TEXT,
        FOREIGN KEY(checkin_id) REFERENCES checkins(id) ON DELETE CASCADE
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS gad2_assessments (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        nervous_score INTEGER NOT NULL CHECK(nervous_score >= 0 AND nervous_score <= 3),
        control_score INTEGER NOT NULL CHECK(control_score >= 0 AND control_score <= 3),
        total_score INTEGER NOT NULL CHECK(total_score >= 0 AND total_score <= 6)
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS reminder_preferences (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        enabled INTEGER NOT NULL DEFAULT 1,
        adaptive INTEGER NOT NULL DEFAULT 1,
        quiet_start_min INTEGER NOT NULL DEFAULT 1320,
        quiet_end_min INTEGER NOT NULL DEFAULT 480,
        max_per_day INTEGER NOT NULL DEFAULT 2,
        updated_at INTEGER NOT NULL
      );
      `,
      `
      INSERT OR IGNORE INTO reminder_preferences
      (id, enabled, adaptive, quiet_start_min, quiet_end_min, max_per_day, updated_at)
      VALUES (1, 1, 1, 1320, 480, 2, strftime('%s','now') * 1000);
      `,
      `
      CREATE TABLE IF NOT EXISTS safety_plan (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        coping_text TEXT NOT NULL DEFAULT '',
        trusted_contact TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );
      `,
      `
      INSERT OR IGNORE INTO safety_plan
      (id, coping_text, trusted_contact, updated_at)
      VALUES (1, '', '', strftime('%s','now') * 1000);
      `,
      `
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        last_sync_at INTEGER,
        last_error TEXT,
        updated_at INTEGER NOT NULL
      );
      `,
      `
      INSERT OR IGNORE INTO sync_state
      (id, enabled, last_sync_at, last_error, updated_at)
      VALUES (1, 0, NULL, NULL, strftime('%s','now') * 1000);
      `,
      `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'done', 'error')),
        error_msg TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      `,
      'CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON checkins(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_intervention_sessions_started_at ON intervention_sessions(started_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_gad2_assessments_created_at ON gad2_assessments(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created_at ON sync_queue(status, created_at);',
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
