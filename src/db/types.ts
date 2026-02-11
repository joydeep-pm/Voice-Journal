export type AiStatus = 'none' | 'queued' | 'transcribed' | 'summarized' | 'error';
export type Workspace = 'professional' | 'personal';

export type DbOptions = {
  workspace?: Workspace;
};

export type Tag = {
  id: string;
  name: string;
};

export type Entry = {
  id: string;
  createdAt: number;
  audioUri: string;
  durationSec: number;
  transcript: string | null;
  summary: string | null;
  mood: string | null;
  aiStatus: AiStatus;
  errorMsg: string | null;
  tags: Tag[];
};

export type EntryPatch = Partial<
  Pick<Entry, 'audioUri' | 'durationSec' | 'transcript' | 'summary' | 'mood' | 'aiStatus' | 'errorMsg'>
>;

export type CreateEntryInput = {
  audioUri: string;
  durationSec: number;
};

export type AiJobType = 'transcribe' | 'summarize';
export type AiJobStatus = 'queued' | 'running' | 'done' | 'error';

export type AiJob = {
  id: string;
  entryId: string;
  type: AiJobType;
  status: AiJobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type WeeklyCount = {
  week: string;
  count: number;
};

export type TopTag = {
  tagId: string;
  tagName: string;
  count: number;
};

export type WeeklyTheme = {
  week: string;
  theme: string;
  entryIds: string[];
};

export type WorkspaceInitState = {
  switchEnabled: boolean;
  professionalSource: 'professional' | 'legacy';
  migrationError: string | null;
};

export type InterventionType = 'breathing' | 'grounding' | 'reframe';

export type StressCheckIn = {
  id: string;
  entryId: string | null;
  createdAt: number;
  stressIntensity: number;
  triggerTags: string[];
  recommendedTool: InterventionType;
  note: string | null;
};

export type CreateStressCheckInInput = {
  entryId?: string | null;
  stressIntensity: number;
  triggerTags?: string[];
  note?: string | null;
};

export type InterventionSession = {
  id: string;
  checkInId: string;
  type: InterventionType;
  startedAt: number;
  completedAt: number | null;
  reliefDelta: number | null;
  details: string | null;
};

export type Gad2Assessment = {
  id: string;
  createdAt: number;
  nervousScore: number;
  controlScore: number;
  totalScore: number;
};

export type CreateGad2AssessmentInput = {
  nervousScore: number;
  controlScore: number;
};

export type ReminderPreferences = {
  enabled: boolean;
  adaptive: boolean;
  quietStartMin: number;
  quietEndMin: number;
  maxPerDay: number;
  updatedAt: number;
};

export type ReminderPreferencePatch = Partial<
  Pick<ReminderPreferences, 'enabled' | 'adaptive' | 'quietStartMin' | 'quietEndMin' | 'maxPerDay'>
>;

export type SafetyPlan = {
  copingText: string;
  trustedContact: string;
  updatedAt: number;
};

export type SyncState = {
  enabled: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  updatedAt: number;
};
