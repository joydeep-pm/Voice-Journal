import { getDb, initDb } from '@/src/db/client';
import { updateEntry } from '@/src/db/entries';
import type { AiJob, AiJobType, DbOptions } from '@/src/db/types';

type AiJobRow = {
  id: string;
  entry_id: string;
  type: AiJobType;
  status: AiJob['status'];
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
};

function makeId(prefix = 'job'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toAiJob(row: AiJobRow): AiJob {
  return {
    id: row.id,
    entryId: row.entry_id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueAiJob(
  entryId: string,
  type: AiJobType,
  options: DbOptions = {}
): Promise<{ enqueued: boolean; jobId?: string }> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);

  const existing = await db.getFirstAsync<{ id: string }>(
    `
    SELECT id FROM ai_jobs
    WHERE entry_id = ? AND type = ? AND status IN ('queued', 'running')
    LIMIT 1;
    `,
    entryId,
    type
  );

  if (existing) {
    return { enqueued: false, jobId: existing.id };
  }

  const now = Date.now();
  const id = makeId();

  await db.runAsync(
    `
    INSERT INTO ai_jobs (id, entry_id, type, status, attempts, last_error, created_at, updated_at)
    VALUES (?, ?, ?, 'queued', 0, NULL, ?, ?);
    `,
    id,
    entryId,
    type,
    now,
    now
  );

  await updateEntry(entryId, { aiStatus: 'queued', errorMsg: null }, options);
  return { enqueued: true, jobId: id };
}

export async function claimNextQueuedAiJob(options: DbOptions = {}): Promise<AiJob | null> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);

  const next = await db.getFirstAsync<AiJobRow>(
    `
    SELECT * FROM ai_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1;
    `
  );

  if (!next) {
    return null;
  }

  const now = Date.now();
  const updated = await db.runAsync(
    `
    UPDATE ai_jobs
    SET status = 'running', updated_at = ?
    WHERE id = ? AND status = 'queued';
    `,
    now,
    next.id
  );

  if (!updated.changes) {
    return null;
  }

  const claimed = await db.getFirstAsync<AiJobRow>('SELECT * FROM ai_jobs WHERE id = ? LIMIT 1;', next.id);
  return claimed ? toAiJob(claimed) : null;
}

export async function markAiJobDone(jobId: string, options: DbOptions = {}): Promise<void> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  await db.runAsync('UPDATE ai_jobs SET status = ?, updated_at = ? WHERE id = ?;', 'done', Date.now(), jobId);
}

export async function requeueOrFailAiJob(
  job: AiJob,
  errorMessage: string,
  maxAttempts = 3,
  options: DbOptions = {}
): Promise<void> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);

  const attempts = job.attempts + 1;
  const failed = attempts >= maxAttempts;
  const nextStatus: AiJob['status'] = failed ? 'error' : 'queued';
  const now = Date.now();

  await db.runAsync(
    `
    UPDATE ai_jobs
    SET status = ?, attempts = ?, last_error = ?, updated_at = ?
    WHERE id = ?;
    `,
    nextStatus,
    attempts,
    errorMessage,
    now,
    job.id
  );

  await updateEntry(
    job.entryId,
    {
      aiStatus: failed ? 'error' : 'queued',
      errorMsg: errorMessage,
    },
    options
  );
}

export async function listAiJobs(options: DbOptions = {}): Promise<AiJob[]> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const rows = await db.getAllAsync<AiJobRow>('SELECT * FROM ai_jobs ORDER BY created_at DESC;');
  return rows.map(toAiJob);
}
