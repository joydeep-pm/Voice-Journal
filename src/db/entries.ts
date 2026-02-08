import { getDb, initDb } from '@/src/db/client';
import type {
  AiStatus,
  CreateEntryInput,
  Entry,
  EntryPatch,
  Tag,
  TopTag,
  WeeklyCount,
} from '@/src/db/types';

type EntryRow = {
  id: string;
  created_at: number;
  audio_uri: string;
  duration_sec: number;
  transcript: string | null;
  summary: string | null;
  mood: string | null;
  ai_status: AiStatus;
  error_msg: string | null;
  tag_blob: string | null;
};

type TagRow = {
  id: string;
  name: string;
};

function makeId(prefix = 'entry'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTagBlob(blob: string | null): Tag[] {
  if (!blob) {
    return [];
  }

  return blob
    .split('||')
    .map((item) => {
      const [id, ...nameParts] = item.split('::');
      const name = nameParts.join('::').trim();
      if (!id || !name) {
        return null;
      }
      return { id, name };
    })
    .filter((value): value is Tag => Boolean(value));
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    createdAt: row.created_at,
    audioUri: row.audio_uri,
    durationSec: row.duration_sec,
    transcript: row.transcript,
    summary: row.summary,
    mood: row.mood,
    aiStatus: row.ai_status,
    errorMsg: row.error_msg,
    tags: parseTagBlob(row.tag_blob),
  };
}

const ENTRY_SELECT = `
SELECT
  e.id,
  e.created_at,
  e.audio_uri,
  e.duration_sec,
  e.transcript,
  e.summary,
  e.mood,
  e.ai_status,
  e.error_msg,
  GROUP_CONCAT(t.id || '::' || t.name, '||') AS tag_blob
FROM entries e
LEFT JOIN entry_tags et ON et.entry_id = e.id
LEFT JOIN tags t ON t.id = et.tag_id
`;

export async function createEntry({ audioUri, durationSec }: CreateEntryInput): Promise<Entry> {
  await initDb();
  const db = await getDb();

  const id = makeId();
  const createdAt = Date.now();

  await db.runAsync(
    `
    INSERT INTO entries (id, created_at, audio_uri, duration_sec, transcript, summary, mood, ai_status, error_msg)
    VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'none', NULL);
    `,
    id,
    createdAt,
    audioUri,
    Math.max(0, Math.round(durationSec))
  );

  const entry = await getEntry(id);
  if (!entry) {
    throw new Error('Failed to load created entry.');
  }

  return entry;
}

export async function listEntries(): Promise<Entry[]> {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<EntryRow>(`${ENTRY_SELECT} GROUP BY e.id ORDER BY e.created_at DESC;`);
  return rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  await initDb();
  const db = await getDb();

  const row = await db.getFirstAsync<EntryRow>(`${ENTRY_SELECT} WHERE e.id = ? GROUP BY e.id LIMIT 1;`, id);
  return row ? toEntry(row) : null;
}

const PATCH_COLUMN_MAP: Record<keyof EntryPatch, string> = {
  audioUri: 'audio_uri',
  durationSec: 'duration_sec',
  transcript: 'transcript',
  summary: 'summary',
  mood: 'mood',
  aiStatus: 'ai_status',
  errorMsg: 'error_msg',
};

export async function updateEntry(id: string, patch: EntryPatch): Promise<void> {
  await initDb();
  const db = await getDb();

  const sets: string[] = [];
  const values: Array<string | number | null> = [];

  for (const [key, value] of Object.entries(patch) as Array<[keyof EntryPatch, EntryPatch[keyof EntryPatch]]>) {
    const column = PATCH_COLUMN_MAP[key];
    if (!column) {
      continue;
    }

    sets.push(`${column} = ?`);
    values.push(value ?? null);
  }

  if (!sets.length) {
    return;
  }

  values.push(id);
  await db.runAsync(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?;`, ...values);
}

export async function deleteEntry(id: string): Promise<void> {
  await initDb();
  const db = await getDb();

  await db.runAsync('DELETE FROM entries WHERE id = ?;', id);
}

function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function createTag(name: string): Promise<Tag> {
  await initDb();
  const db = await getDb();

  const clean = normalizeTagName(name);
  if (!clean) {
    throw new Error('Tag name cannot be empty.');
  }

  const existing = await db.getFirstAsync<TagRow>('SELECT id, name FROM tags WHERE lower(name) = lower(?) LIMIT 1;', clean);
  if (existing) {
    return existing;
  }

  const id = makeId('tag');
  await db.runAsync('INSERT INTO tags (id, name) VALUES (?, ?);', id, clean);
  return { id, name: clean };
}

export async function listTags(): Promise<Tag[]> {
  await initDb();
  const db = await getDb();

  return db.getAllAsync<TagRow>('SELECT id, name FROM tags ORDER BY lower(name) ASC;');
}

export async function attachTag(entryId: string, tagId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?);', entryId, tagId);
}

export async function detachTag(entryId: string, tagId: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.runAsync('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?;', entryId, tagId);
}

export async function searchEntries(query: string): Promise<Entry[]> {
  await initDb();
  const db = await getDb();

  const q = `%${query.trim().toLowerCase()}%`;
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE lower(COALESCE(e.transcript, '') || ' ' || COALESCE(e.summary, '')) LIKE ?
     GROUP BY e.id
     ORDER BY e.created_at DESC;`,
    q
  );

  return rows.map(toEntry);
}

export async function listWeeklyCounts(): Promise<WeeklyCount[]> {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<{ week: string; count: number }>(
    `
    SELECT strftime('%Y-W%W', created_at / 1000, 'unixepoch') AS week, COUNT(*) AS count
    FROM entries
    GROUP BY week
    ORDER BY week DESC;
    `
  );

  return rows.map((row) => ({ week: row.week, count: row.count }));
}

export async function listTopTags(limit = 10): Promise<TopTag[]> {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<{ tag_id: string; tag_name: string; count: number }>(
    `
    SELECT t.id AS tag_id, t.name AS tag_name, COUNT(et.entry_id) AS count
    FROM tags t
    LEFT JOIN entry_tags et ON et.tag_id = t.id
    GROUP BY t.id, t.name
    ORDER BY count DESC, lower(t.name) ASC
    LIMIT ?;
    `,
    limit
  );

  return rows.map((row) => ({ tagId: row.tag_id, tagName: row.tag_name, count: row.count }));
}

export async function listEntriesWithSummary(): Promise<Entry[]> {
  await initDb();
  const db = await getDb();

  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE COALESCE(trim(e.summary), '') <> ''
     GROUP BY e.id
     ORDER BY e.created_at DESC;`
  );

  return rows.map(toEntry);
}

export async function exportJournalData() {
  await initDb();
  const db = await getDb();

  const entries = await db.getAllAsync('SELECT * FROM entries ORDER BY created_at DESC;');
  const tags = await db.getAllAsync('SELECT * FROM tags ORDER BY lower(name) ASC;');
  const entryTags = await db.getAllAsync('SELECT * FROM entry_tags ORDER BY entry_id ASC, tag_id ASC;');
  const aiJobs = await db.getAllAsync('SELECT * FROM ai_jobs ORDER BY created_at DESC;');

  return {
    exportedAt: Date.now(),
    entries,
    tags,
    entryTags,
    aiJobs,
  };
}
