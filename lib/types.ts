export type AiStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error';

export type Mood = 'neutral' | 'happy' | 'sad' | 'anxious' | 'grateful' | 'stressed';

export type Entry = {
  id: number;
  audioUri: string;
  durationSec: number;
  transcript: string | null;
  summary: string | null;
  title: string | null;
  mood: Mood | null;
  aiStatus: AiStatus;
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
};

export type EntryPatch = Partial<Pick<Entry, 'transcript' | 'summary' | 'title' | 'mood' | 'aiStatus' | 'aiError'>>;

export type Tag = {
  id: number;
  name: string;
};

export type AiJobKind = 'transcribe' | 'summarize';

export type AiJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export type AiJob = {
  id: number;
  entryId: number;
  kind: AiJobKind;
  status: AiJobStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyCount = {
  week: string;
  count: number;
};

export type TopTag = {
  tagId: number;
  tagName: string;
  count: number;
};

export type WeeklyTheme = {
  week: string;
  theme: string;
  entryIds: number[];
};
