export type AiStatus = 'none' | 'queued' | 'transcribed' | 'summarized' | 'error';

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
