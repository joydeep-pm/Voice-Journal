import { create } from 'zustand';
import { runAiWorker } from '@/lib/aiWorker';
import { getDb } from '@/lib/db';
import {
  attachTag,
  createEntry,
  createTag,
  deleteEntry,
  detachTag,
  enqueueAiJob,
  getEntry,
  listEntries,
  listTags,
  updateEntry,
} from '@/lib/repository';
import type { Entry, EntryPatch, Tag } from '@/lib/types';

type JournalState = {
  entries: Entry[];
  tags: Tag[];
  loadingEntries: boolean;
  loadingTags: boolean;
  error: string | null;
  logs: string[];
  initialized: boolean;
  bootstrap: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  refreshTags: () => Promise<void>;
  createEntryAction: (audioUri: string, durationSec: number) => Promise<Entry>;
  updateEntryAction: (id: number, patch: EntryPatch) => Promise<Entry | null>;
  deleteEntryAction: (id: number) => Promise<void>;
  getEntryAction: (id: number) => Promise<Entry | null>;
  addTagAction: (name: string) => Promise<Tag>;
  attachTagAction: (entryId: number, tagId: number) => Promise<void>;
  detachTagAction: (entryId: number, tagId: number) => Promise<void>;
  enqueueTranscribeAction: (entryId: number) => Promise<boolean>;
  runWorkerNow: () => Promise<void>;
  pushLog: (message: string) => void;
  clearError: () => void;
};

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  tags: [],
  loadingEntries: false,
  loadingTags: false,
  error: null,
  logs: [],
  initialized: false,

  pushLog: (message) => {
    set((state) => ({
      logs: [`${new Date().toLocaleTimeString()} ${message}`, ...state.logs].slice(0, 100),
    }));
  },

  clearError: () => set({ error: null }),

  bootstrap: async () => {
    if (get().initialized) {
      return;
    }

    try {
      await getDb();
      await Promise.all([get().refreshEntries(), get().refreshTags()]);
      set({ initialized: true });
      await get().runWorkerNow();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize app.' });
    }
  },

  refreshEntries: async () => {
    set({ loadingEntries: true, error: null });
    try {
      const entries = await listEntries();
      set({ entries, loadingEntries: false });
    } catch (error) {
      set({
        loadingEntries: false,
        error: error instanceof Error ? error.message : 'Failed to load entries.',
      });
    }
  },

  refreshTags: async () => {
    set({ loadingTags: true, error: null });
    try {
      const tags = await listTags();
      set({ tags, loadingTags: false });
    } catch (error) {
      set({
        loadingTags: false,
        error: error instanceof Error ? error.message : 'Failed to load tags.',
      });
    }
  },

  createEntryAction: async (audioUri, durationSec) => {
    const entry = await createEntry(audioUri, durationSec);
    await get().refreshEntries();
    return entry;
  },

  updateEntryAction: async (id, patch) => {
    const entry = await updateEntry(id, patch);
    await get().refreshEntries();
    return entry;
  },

  deleteEntryAction: async (id) => {
    await deleteEntry(id);
    await get().refreshEntries();
  },

  getEntryAction: async (id) => getEntry(id),

  addTagAction: async (name) => {
    const tag = await createTag(name);
    await get().refreshTags();
    await get().refreshEntries();
    return tag;
  },

  attachTagAction: async (entryId, tagId) => {
    await attachTag(entryId, tagId);
    await get().refreshEntries();
  },

  detachTagAction: async (entryId, tagId) => {
    await detachTag(entryId, tagId);
    await get().refreshEntries();
  },

  enqueueTranscribeAction: async (entryId) => {
    const result = await enqueueAiJob(entryId, 'transcribe');
    if (result.enqueued) {
      get().pushLog(`Queued transcription for entry ${entryId}`);
      await get().runWorkerNow();
    } else {
      get().pushLog(`Skipped duplicate transcription queue for entry ${entryId}`);
    }
    await get().refreshEntries();
    return result.enqueued;
  },

  runWorkerNow: async () => {
    await runAiWorker((message) => get().pushLog(message));
    await get().refreshEntries();
  },
}));
