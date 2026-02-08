export { initDb } from '@/src/db/client';
export {
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  createTag,
  listTags,
  attachTag,
  detachTag,
  searchEntries,
  listWeeklyCounts,
  listTopTags,
  listEntriesWithSummary,
  exportJournalData,
} from '@/src/db/entries';
export { enqueueAiJob, listAiJobs } from '@/src/db/jobs';
export type { Entry, EntryPatch, Tag, AiJob, WeeklyCount, TopTag, WeeklyTheme } from '@/src/db/types';
