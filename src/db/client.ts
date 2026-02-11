import * as SQLite from 'expo-sqlite';
import { runMigrations } from '@/src/db/schema';
import type { Workspace, WorkspaceInitState } from '@/src/db/types';
import { getActiveWorkspaceState } from '@/src/workspace/state';

const LEGACY_DB_NAME = 'voice_journal_app.db';
const WORKSPACE_DB_NAMES: Record<Workspace, string> = {
  professional: 'voice_journal_professional.db',
  personal: 'voice_journal_personal.db',
};

const dbPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();
const initPromises = new Map<string, Promise<void>>();
let bootstrapPromise: Promise<void> | null = null;

const initState: WorkspaceInitState = {
  switchEnabled: true,
  professionalSource: 'professional',
  migrationError: null,
};

function resolveWorkspace(workspace?: Workspace): Workspace {
  return workspace ?? getActiveWorkspaceState();
}

function dbNameForWorkspace(workspace: Workspace): string {
  if (workspace === 'professional' && initState.professionalSource === 'legacy') {
    return LEGACY_DB_NAME;
  }
  return WORKSPACE_DB_NAMES[workspace];
}

async function openDbByName(dbName: string): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromises.has(dbName)) {
    dbPromises.set(dbName, SQLite.openDatabaseAsync(dbName));
  }
  return dbPromises.get(dbName)!;
}

async function runMigrationsByName(dbName: string): Promise<void> {
  if (!initPromises.has(dbName)) {
    const promise = (async () => {
      const db = await openDbByName(dbName);
      await runMigrations(db);
    })().catch((error) => {
      initPromises.delete(dbName);
      throw error;
    });
    initPromises.set(dbName, promise);
  }

  await initPromises.get(dbName);
}

async function tableExists(db: SQLite.SQLiteDatabase, table: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;`,
    table
  );
  return Boolean(row?.name);
}

async function rowCount(db: SQLite.SQLiteDatabase, table: string): Promise<number> {
  const exists = await tableExists(db, table);
  if (!exists) {
    return 0;
  }
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table};`);
  return row?.count ?? 0;
}

async function legacyHasMigratableData(legacyDb: SQLite.SQLiteDatabase): Promise<boolean> {
  const hasEntries = await tableExists(legacyDb, 'entries');
  if (!hasEntries) {
    return false;
  }

  const count = await rowCount(legacyDb, 'entries');
  return count > 0;
}

async function copyLegacyToProfessionalIfNeeded(): Promise<void> {
  const legacyDb = await openDbByName(LEGACY_DB_NAME);
  const professionalDb = await openDbByName(WORKSPACE_DB_NAMES.professional);

  const migratable = await legacyHasMigratableData(legacyDb);
  if (!migratable) {
    return;
  }

  const tables = ['entries', 'tags', 'entry_tags', 'ai_jobs'] as const;

  const legacyCounts = {
    entries: await rowCount(legacyDb, 'entries'),
    tags: await rowCount(legacyDb, 'tags'),
    entry_tags: await rowCount(legacyDb, 'entry_tags'),
    ai_jobs: await rowCount(legacyDb, 'ai_jobs'),
  };

  const professionalCounts = {
    entries: await rowCount(professionalDb, 'entries'),
    tags: await rowCount(professionalDb, 'tags'),
    entry_tags: await rowCount(professionalDb, 'entry_tags'),
    ai_jobs: await rowCount(professionalDb, 'ai_jobs'),
  };

  const professionalHasData = Object.values(professionalCounts).some((count) => count > 0);
  const alreadyMatching = tables.every((table) => legacyCounts[table] === professionalCounts[table]);

  if (professionalHasData && alreadyMatching) {
    return;
  }

  if (professionalHasData && !alreadyMatching) {
    throw new Error('Professional database has mismatched row counts; cannot safely migrate legacy data.');
  }

  const hasLegacyTags = await tableExists(legacyDb, 'tags');
  const hasLegacyEntryTags = await tableExists(legacyDb, 'entry_tags');
  const hasLegacyAiJobs = await tableExists(legacyDb, 'ai_jobs');

  const entries = await legacyDb.getAllAsync<{
    id: string;
    created_at: number;
    audio_uri: string;
    duration_sec: number;
    transcript: string | null;
    summary: string | null;
    mood: string | null;
    ai_status: string;
    error_msg: string | null;
  }>('SELECT * FROM entries;');
  const tags = hasLegacyTags
    ? await legacyDb.getAllAsync<{ id: string; name: string }>('SELECT * FROM tags;')
    : [];
  const entryTags = hasLegacyEntryTags
    ? await legacyDb.getAllAsync<{ entry_id: string; tag_id: string }>('SELECT * FROM entry_tags;')
    : [];
  const aiJobs = hasLegacyAiJobs
    ? await legacyDb.getAllAsync<{
        id: string;
        entry_id: string;
        type: string;
        status: string;
        attempts: number;
        last_error: string | null;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM ai_jobs;')
    : [];

  await professionalDb.withTransactionAsync(async () => {
    for (const row of entries) {
      await professionalDb.runAsync(
        `
        INSERT OR REPLACE INTO entries
        (id, created_at, audio_uri, duration_sec, transcript, summary, mood, ai_status, error_msg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        row.id,
        row.created_at,
        row.audio_uri,
        row.duration_sec,
        row.transcript,
        row.summary,
        row.mood,
        row.ai_status,
        row.error_msg
      );
    }

    for (const row of tags) {
      await professionalDb.runAsync('INSERT OR REPLACE INTO tags (id, name) VALUES (?, ?);', row.id, row.name);
    }

    for (const row of entryTags) {
      await professionalDb.runAsync(
        'INSERT OR REPLACE INTO entry_tags (entry_id, tag_id) VALUES (?, ?);',
        row.entry_id,
        row.tag_id
      );
    }

    for (const row of aiJobs) {
      await professionalDb.runAsync(
        `
        INSERT OR REPLACE INTO ai_jobs
        (id, entry_id, type, status, attempts, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `,
        row.id,
        row.entry_id,
        row.type,
        row.status,
        row.attempts,
        row.last_error,
        row.created_at,
        row.updated_at
      );
    }
  });

  const migratedCounts = {
    entries: await rowCount(professionalDb, 'entries'),
    tags: await rowCount(professionalDb, 'tags'),
    entry_tags: await rowCount(professionalDb, 'entry_tags'),
    ai_jobs: await rowCount(professionalDb, 'ai_jobs'),
  };

  const parityOk = tables.every((table) => legacyCounts[table] === migratedCounts[table]);
  if (!parityOk) {
    throw new Error(
      `Legacy migration parity failed. Legacy=${JSON.stringify(legacyCounts)} migrated=${JSON.stringify(migratedCounts)}`
    );
  }
}

export async function initializeWorkspaceDatabases(): Promise<WorkspaceInitState> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await runMigrationsByName(WORKSPACE_DB_NAMES.professional);
      await runMigrationsByName(WORKSPACE_DB_NAMES.personal);

      try {
        await copyLegacyToProfessionalIfNeeded();
      } catch (error) {
        initState.professionalSource = 'legacy';
        initState.switchEnabled = false;
        initState.migrationError = error instanceof Error ? error.message : 'Unknown migration error.';
        await runMigrationsByName(LEGACY_DB_NAME);
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
  return { ...initState };
}

export function getWorkspaceInitState(): WorkspaceInitState {
  return { ...initState };
}

export async function initDb(workspace?: Workspace): Promise<void> {
  await initializeWorkspaceDatabases();
  const resolved = resolveWorkspace(workspace);
  await runMigrationsByName(dbNameForWorkspace(resolved));
}

export async function getDb(workspace?: Workspace): Promise<SQLite.SQLiteDatabase> {
  const resolved = resolveWorkspace(workspace);
  await initDb(resolved);
  return openDbByName(dbNameForWorkspace(resolved));
}
