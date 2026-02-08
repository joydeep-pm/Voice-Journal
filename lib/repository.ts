import { getDb } from '@/lib/db';
import type {
  AiJob,
  AiJobKind,
  Entry,
  EntryPatch,
  Mood,
  Tag,
  TopTag,
  WeeklyCount,
} from '@/lib/types';

type EntryRow = {
  id: number;
  audio_uri: string;
  duration_sec: number;
  transcript: string | null;
  summary: string | null;
  title: string | null;
  mood: Mood | null;
  ai_status: Entry['aiStatus'];
  ai_error: string | null;
  created_at: string;
  updated_at: string;
  tag_blob: string | null;
};

type TagRow = {
  id: number;
  name: string;
};

type AiJobRow = {
  id: number;
  entry_id: number;
  kind: AiJobKind;
  status: AiJob['status'];
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parseTagBlob(blob: string | null): Tag[] {
  if (!blob) {
    return [];
  }

  return blob
    .split(',')
    .map((item) => {
      const [idPart, ...nameParts] = item.split(':');
      const name = nameParts.join(':').trim();
      const id = Number(idPart);
      if (!id || !name) {
        return null;
      }
      return { id, name } as Tag;
    })
    .filter((tag): tag is Tag => Boolean(tag));
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    audioUri: row.audio_uri,
    durationSec: row.duration_sec,
    transcript: row.transcript,
    summary: row.summary,
    title: row.title,
    mood: row.mood,
    aiStatus: row.ai_status,
    aiError: row.ai_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: parseTagBlob(row.tag_blob),
  };
}

function toAiJob(row: AiJobRow): AiJob {
  return {
    id: row.id,
    entryId: row.entry_id,
    kind: row.kind,
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ENTRY_SELECT = `
  SELECT
    e.id,
    e.audio_uri,
    e.duration_sec,
    e.transcript,
    e.summary,
    e.title,
    e.mood,
    e.ai_status,
    e.ai_error,
    e.created_at,
    e.updated_at,
    GROUP_CONCAT(t.id || ':' || t.name) AS tag_blob
  FROM entries e
  LEFT JOIN entry_tags et ON et.entry_id = e.id
  LEFT JOIN tags t ON t.id = et.tag_id
`;

export async function createEntry(audioUri: string, durationSec: number): Promise<Entry> {
  const db = await getDb();
  const now = nowIso();

  const result = await db.runAsync(
    `
      INSERT INTO entries (
        audio_uri,
        duration_sec,
        transcript,
        summary,
        title,
        mood,
        ai_status,
        ai_error,
        created_at,
        updated_at
      )
      VALUES (?, ?, NULL, NULL, NULL, NULL, 'idle', NULL, ?, ?)
    `,
    audioUri,
    Math.round(durationSec),
    now,
    now
  );

  const id = Number(result.lastInsertRowId);
  const entry = await getEntry(id);
  if (!entry) {
    throw new Error('Failed to fetch newly created entry.');
  }
  return entry;
}

export async function listEntries(): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(`${ENTRY_SELECT} GROUP BY e.id ORDER BY datetime(e.created_at) DESC;`);
  return rows.map(toEntry);
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>(`${ENTRY_SELECT} WHERE e.id = ? GROUP BY e.id LIMIT 1;`, id);
  return row ? toEntry(row) : null;
}

const ENTRY_PATCH_MAP: Record<keyof EntryPatch, string> = {
  transcript: 'transcript',
  summary: 'summary',
  title: 'title',
  mood: 'mood',
  aiStatus: 'ai_status',
  aiError: 'ai_error',
};

export async function updateEntry(id: number, patch: EntryPatch): Promise<Entry | null> {
  const db = await getDb();
  const sets: string[] = [];
  const values: Array<string | number | null> = [];

  for (const [key, value] of Object.entries(patch) as [keyof EntryPatch, EntryPatch[keyof EntryPatch]][]) {
    const column = ENTRY_PATCH_MAP[key];
    if (!column) {
      continue;
    }
    sets.push(`${column} = ?`);
    values.push(value ?? null);
  }

  sets.push('updated_at = ?');
  values.push(nowIso());
  values.push(id);

  await db.runAsync(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?;`, ...values);
  return getEntry(id);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?;', id);
}

export async function createTag(name: string): Promise<Tag> {
  const db = await getDb();
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Tag name cannot be empty.');
  }

  const now = nowIso();
  await db.runAsync('INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?);', cleanName, now);

  const tag = await db.getFirstAsync<TagRow>('SELECT id, name FROM tags WHERE lower(name) = lower(?) LIMIT 1;', cleanName);
  if (!tag) {
    throw new Error('Failed to create or fetch tag.');
  }

  return { id: tag.id, name: tag.name };
}

export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TagRow>('SELECT id, name FROM tags ORDER BY lower(name) ASC;');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function attachTag(entryId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, created_at) VALUES (?, ?, ?);',
    entryId,
    tagId,
    nowIso()
  );
  await db.runAsync('UPDATE entries SET updated_at = ? WHERE id = ?;', nowIso(), entryId);
}

export async function detachTag(entryId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?;', entryId, tagId);
  await db.runAsync('UPDATE entries SET updated_at = ? WHERE id = ?;', nowIso(), entryId);
}

export async function searchEntries(query: string): Promise<Entry[]> {
  const db = await getDb();
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE lower(COALESCE(e.transcript, '') || ' ' || COALESCE(e.summary, '') || ' ' || COALESCE(e.title, '')) LIKE ?
     GROUP BY e.id
     ORDER BY datetime(e.created_at) DESC;`,
    q
  );

  return rows.map(toEntry);
}

export async function listWeeklyCounts(): Promise<WeeklyCount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ week: string; count: number }>(
    `
      SELECT strftime('%Y-W%W', created_at) AS week, COUNT(*) AS count
      FROM entries
      GROUP BY week
      ORDER BY week DESC;
    `
  );

  return rows.map((row) => ({ week: row.week, count: row.count }));
}

export async function listTopTags(limit = 10): Promise<TopTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tag_id: number; tag_name: string; count: number }>(
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
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    `${ENTRY_SELECT}
     WHERE COALESCE(trim(e.summary), '') <> ''
     GROUP BY e.id
     ORDER BY datetime(e.created_at) DESC;`
  );
  return rows.map(toEntry);
}

export async function enqueueAiJob(entryId: number, kind: AiJobKind): Promise<{ enqueued: boolean; job?: AiJob }> {
  const db = await getDb();

  const existing = await db.getFirstAsync<AiJobRow>(
    `
      SELECT * FROM ai_jobs
      WHERE entry_id = ? AND kind = ? AND status IN ('queued', 'processing')
      ORDER BY id DESC
      LIMIT 1;
    `,
    entryId,
    kind
  );

  if (existing) {
    return { enqueued: false, job: toAiJob(existing) };
  }

  const now = nowIso();
  const inserted = await db.runAsync(
    `
      INSERT INTO ai_jobs (entry_id, kind, status, attempt_count, last_error, created_at, updated_at)
      VALUES (?, ?, 'queued', 0, NULL, ?, ?);
    `,
    entryId,
    kind,
    now,
    now
  );

  const jobRow = await db.getFirstAsync<AiJobRow>('SELECT * FROM ai_jobs WHERE id = ? LIMIT 1;', inserted.lastInsertRowId);
  await db.runAsync(
    `
      UPDATE entries
      SET ai_status = 'queued', ai_error = NULL, updated_at = ?
      WHERE id = ?;
    `,
    nowIso(),
    entryId
  );

  return { enqueued: true, job: jobRow ? toAiJob(jobRow) : undefined };
}

export async function claimNextQueuedAiJob(): Promise<AiJob | null> {
  const db = await getDb();
  const next = await db.getFirstAsync<AiJobRow>(
    `
      SELECT * FROM ai_jobs
      WHERE status = 'queued'
      ORDER BY datetime(created_at) ASC, id ASC
      LIMIT 1;
    `
  );

  if (!next) {
    return null;
  }

  const updated = await db.runAsync(
    `
      UPDATE ai_jobs
      SET status = 'processing', updated_at = ?
      WHERE id = ? AND status = 'queued';
    `,
    nowIso(),
    next.id
  );

  if (!updated.changes) {
    return null;
  }

  const claimed = await db.getFirstAsync<AiJobRow>('SELECT * FROM ai_jobs WHERE id = ? LIMIT 1;', next.id);
  if (!claimed) {
    return null;
  }

  await db.runAsync(`UPDATE entries SET ai_status = 'processing', ai_error = NULL, updated_at = ? WHERE id = ?;`, nowIso(), claimed.entry_id);

  return toAiJob(claimed);
}

export async function markAiJobDone(jobId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE ai_jobs SET status = 'done', updated_at = ? WHERE id = ?;`, nowIso(), jobId);
}

export async function requeueOrFailAiJob(job: AiJob, errorMessage: string, maxRetries = 3): Promise<void> {
  const db = await getDb();
  const nextAttempt = job.attemptCount + 1;
  const shouldFail = nextAttempt >= maxRetries;
  const status: AiJob['status'] = shouldFail ? 'failed' : 'queued';

  await db.runAsync(
    `
      UPDATE ai_jobs
      SET status = ?, attempt_count = ?, last_error = ?, updated_at = ?
      WHERE id = ?;
    `,
    status,
    nextAttempt,
    errorMessage,
    nowIso(),
    job.id
  );

  await db.runAsync(
    `
      UPDATE entries
      SET ai_status = ?, ai_error = ?, updated_at = ?
      WHERE id = ?;
    `,
    shouldFail ? 'error' : 'queued',
    errorMessage,
    nowIso(),
    job.entryId
  );
}

export async function listAiJobs(): Promise<AiJob[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AiJobRow>('SELECT * FROM ai_jobs ORDER BY datetime(created_at) DESC, id DESC;');
  return rows.map(toAiJob);
}

export async function exportJournalData() {
  const db = await getDb();

  const entries = await db.getAllAsync('SELECT * FROM entries ORDER BY datetime(created_at) DESC;');
  const tags = await db.getAllAsync('SELECT * FROM tags ORDER BY lower(name) ASC;');
  const entryTags = await db.getAllAsync('SELECT * FROM entry_tags ORDER BY entry_id ASC, tag_id ASC;');
  const aiJobs = await db.getAllAsync('SELECT * FROM ai_jobs ORDER BY datetime(created_at) DESC;');

  return {
    exportedAt: nowIso(),
    entries,
    tags,
    entryTags,
    aiJobs,
  };
}
