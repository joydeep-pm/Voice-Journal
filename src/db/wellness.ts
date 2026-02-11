import { getDb, initDb } from '@/src/db/client';
import type {
  CreateGad2AssessmentInput,
  CreateStressCheckInInput,
  DbOptions,
  Gad2Assessment,
  InterventionSession,
  InterventionType,
  ReminderPreferencePatch,
  ReminderPreferences,
  SafetyPlan,
  StressCheckIn,
  SyncState,
} from '@/src/db/types';

type CheckInRow = {
  id: string;
  entry_id: string | null;
  created_at: number;
  stress_intensity: number;
  trigger_tags: string | null;
  recommended_tool: InterventionType;
  note: string | null;
};

type SessionRow = {
  id: string;
  checkin_id: string;
  type: InterventionType;
  started_at: number;
  completed_at: number | null;
  relief_delta: number | null;
  details: string | null;
};

type Gad2Row = {
  id: string;
  created_at: number;
  nervous_score: number;
  control_score: number;
  total_score: number;
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function recommendTool(intensity: number): InterventionType {
  if (intensity >= 7) {
    return 'breathing';
  }
  if (intensity >= 4) {
    return 'grounding';
  }
  return 'reframe';
}

function parseTriggerTags(blob: string | null): string[] {
  if (!blob) {
    return [];
  }
  try {
    const parsed = JSON.parse(blob) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function toCheckIn(row: CheckInRow): StressCheckIn {
  return {
    id: row.id,
    entryId: row.entry_id,
    createdAt: row.created_at,
    stressIntensity: row.stress_intensity,
    triggerTags: parseTriggerTags(row.trigger_tags),
    recommendedTool: row.recommended_tool,
    note: row.note,
  };
}

function toSession(row: SessionRow): InterventionSession {
  return {
    id: row.id,
    checkInId: row.checkin_id,
    type: row.type,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    reliefDelta: row.relief_delta,
    details: row.details,
  };
}

function toGad2(row: Gad2Row): Gad2Assessment {
  return {
    id: row.id,
    createdAt: row.created_at,
    nervousScore: row.nervous_score,
    controlScore: row.control_score,
    totalScore: row.total_score,
  };
}

export async function createStressCheckIn(input: CreateStressCheckInInput, options: DbOptions = {}): Promise<StressCheckIn> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);

  const id = makeId('checkin');
  const now = Date.now();
  const stressIntensity = clamp(Math.round(input.stressIntensity), 0, 10);
  const triggerTags = (input.triggerTags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const recommendedTool = recommendTool(stressIntensity);

  await db.runAsync(
    `
    INSERT INTO checkins
    (id, entry_id, created_at, stress_intensity, trigger_tags, recommended_tool, note)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    `,
    id,
    input.entryId ?? null,
    now,
    stressIntensity,
    triggerTags.length ? JSON.stringify(triggerTags) : null,
    recommendedTool,
    input.note ?? null
  );

  const row = await db.getFirstAsync<CheckInRow>('SELECT * FROM checkins WHERE id = ? LIMIT 1;', id);
  if (!row) {
    throw new Error('Failed to create stress check-in.');
  }

  return toCheckIn(row);
}

export async function listRecentStressCheckIns(limit = 20, options: DbOptions = {}): Promise<StressCheckIn[]> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const rows = await db.getAllAsync<CheckInRow>(
    'SELECT * FROM checkins ORDER BY created_at DESC LIMIT ?;',
    Math.max(1, Math.min(100, Math.round(limit)))
  );
  return rows.map(toCheckIn);
}

export async function startInterventionSession(
  checkInId: string,
  type: InterventionType,
  details: string | null = null,
  options: DbOptions = {}
): Promise<InterventionSession> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);

  const id = makeId('session');
  const now = Date.now();
  await db.runAsync(
    `
    INSERT INTO intervention_sessions
    (id, checkin_id, type, started_at, completed_at, relief_delta, details)
    VALUES (?, ?, ?, ?, NULL, NULL, ?);
    `,
    id,
    checkInId,
    type,
    now,
    details
  );

  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM intervention_sessions WHERE id = ? LIMIT 1;', id);
  if (!row) {
    throw new Error('Failed to create intervention session.');
  }
  return toSession(row);
}

export async function completeInterventionSession(
  sessionId: string,
  reliefDelta: number | null,
  details: string | null = null,
  options: DbOptions = {}
): Promise<void> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const normalizedRelief = reliefDelta == null ? null : clamp(Math.round(reliefDelta), -5, 5);
  await db.runAsync(
    `
    UPDATE intervention_sessions
    SET completed_at = ?, relief_delta = ?, details = COALESCE(?, details)
    WHERE id = ?;
    `,
    Date.now(),
    normalizedRelief,
    details,
    sessionId
  );
}

export async function listInterventionSessions(limit = 25, options: DbOptions = {}): Promise<InterventionSession[]> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM intervention_sessions ORDER BY started_at DESC LIMIT ?;',
    Math.max(1, Math.min(100, Math.round(limit)))
  );
  return rows.map(toSession);
}

export async function saveGad2Assessment(
  input: CreateGad2AssessmentInput,
  options: DbOptions = {}
): Promise<Gad2Assessment> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const nervousScore = clamp(Math.round(input.nervousScore), 0, 3);
  const controlScore = clamp(Math.round(input.controlScore), 0, 3);
  const totalScore = nervousScore + controlScore;
  const id = makeId('gad2');
  const now = Date.now();

  await db.runAsync(
    `
    INSERT INTO gad2_assessments
    (id, created_at, nervous_score, control_score, total_score)
    VALUES (?, ?, ?, ?, ?);
    `,
    id,
    now,
    nervousScore,
    controlScore,
    totalScore
  );

  const row = await db.getFirstAsync<Gad2Row>('SELECT * FROM gad2_assessments WHERE id = ? LIMIT 1;', id);
  if (!row) {
    throw new Error('Failed to save GAD-2 assessment.');
  }
  return toGad2(row);
}

export async function listGad2Assessments(limit = 12, options: DbOptions = {}): Promise<Gad2Assessment[]> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const rows = await db.getAllAsync<Gad2Row>(
    'SELECT * FROM gad2_assessments ORDER BY created_at DESC LIMIT ?;',
    Math.max(1, Math.min(52, Math.round(limit)))
  );
  return rows.map(toGad2);
}

export async function getReminderPreferences(options: DbOptions = {}): Promise<ReminderPreferences> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const row = await db.getFirstAsync<{
    enabled: number;
    adaptive: number;
    quiet_start_min: number;
    quiet_end_min: number;
    max_per_day: number;
    updated_at: number;
  }>('SELECT enabled, adaptive, quiet_start_min, quiet_end_min, max_per_day, updated_at FROM reminder_preferences WHERE id = 1;');

  if (!row) {
    const now = Date.now();
    return {
      enabled: true,
      adaptive: true,
      quietStartMin: 1320,
      quietEndMin: 480,
      maxPerDay: 2,
      updatedAt: now,
    };
  }

  return {
    enabled: Boolean(row.enabled),
    adaptive: Boolean(row.adaptive),
    quietStartMin: row.quiet_start_min,
    quietEndMin: row.quiet_end_min,
    maxPerDay: row.max_per_day,
    updatedAt: row.updated_at,
  };
}

export async function updateReminderPreferences(
  patch: ReminderPreferencePatch,
  options: DbOptions = {}
): Promise<ReminderPreferences> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const current = await getReminderPreferences(options);
  const now = Date.now();

  const next: ReminderPreferences = {
    enabled: patch.enabled ?? current.enabled,
    adaptive: patch.adaptive ?? current.adaptive,
    quietStartMin: clamp(Math.round(patch.quietStartMin ?? current.quietStartMin), 0, 1439),
    quietEndMin: clamp(Math.round(patch.quietEndMin ?? current.quietEndMin), 0, 1439),
    maxPerDay: clamp(Math.round(patch.maxPerDay ?? current.maxPerDay), 1, 4),
    updatedAt: now,
  };

  await db.runAsync(
    `
    UPDATE reminder_preferences
    SET enabled = ?, adaptive = ?, quiet_start_min = ?, quiet_end_min = ?, max_per_day = ?, updated_at = ?
    WHERE id = 1;
    `,
    next.enabled ? 1 : 0,
    next.adaptive ? 1 : 0,
    next.quietStartMin,
    next.quietEndMin,
    next.maxPerDay,
    next.updatedAt
  );

  return next;
}

export async function getSafetyPlan(options: DbOptions = {}): Promise<SafetyPlan> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const row = await db.getFirstAsync<{ coping_text: string; trusted_contact: string; updated_at: number }>(
    'SELECT coping_text, trusted_contact, updated_at FROM safety_plan WHERE id = 1;'
  );

  if (!row) {
    return {
      copingText: '',
      trustedContact: '',
      updatedAt: Date.now(),
    };
  }

  return {
    copingText: row.coping_text,
    trustedContact: row.trusted_contact,
    updatedAt: row.updated_at,
  };
}

export async function updateSafetyPlan(
  patch: Partial<Pick<SafetyPlan, 'copingText' | 'trustedContact'>>,
  options: DbOptions = {}
): Promise<SafetyPlan> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const current = await getSafetyPlan(options);
  const now = Date.now();

  const next: SafetyPlan = {
    copingText: patch.copingText ?? current.copingText,
    trustedContact: patch.trustedContact ?? current.trustedContact,
    updatedAt: now,
  };

  await db.runAsync(
    `
    UPDATE safety_plan
    SET coping_text = ?, trusted_contact = ?, updated_at = ?
    WHERE id = 1;
    `,
    next.copingText,
    next.trustedContact,
    next.updatedAt
  );

  return next;
}

export async function getSyncState(options: DbOptions = {}): Promise<SyncState> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const row = await db.getFirstAsync<{ enabled: number; last_sync_at: number | null; last_error: string | null; updated_at: number }>(
    'SELECT enabled, last_sync_at, last_error, updated_at FROM sync_state WHERE id = 1;'
  );

  if (!row) {
    return {
      enabled: false,
      lastSyncAt: null,
      lastError: null,
      updatedAt: Date.now(),
    };
  }

  return {
    enabled: Boolean(row.enabled),
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

export async function updateSyncState(
  patch: Partial<Pick<SyncState, 'enabled' | 'lastSyncAt' | 'lastError'>>,
  options: DbOptions = {}
): Promise<SyncState> {
  await initDb(options.workspace);
  const db = await getDb(options.workspace);
  const current = await getSyncState(options);
  const next: SyncState = {
    enabled: patch.enabled ?? current.enabled,
    lastSyncAt: patch.lastSyncAt === undefined ? current.lastSyncAt : patch.lastSyncAt,
    lastError: patch.lastError === undefined ? current.lastError : patch.lastError,
    updatedAt: Date.now(),
  };

  await db.runAsync(
    `
    UPDATE sync_state
    SET enabled = ?, last_sync_at = ?, last_error = ?, updated_at = ?
    WHERE id = 1;
    `,
    next.enabled ? 1 : 0,
    next.lastSyncAt,
    next.lastError,
    next.updatedAt
  );

  return next;
}
