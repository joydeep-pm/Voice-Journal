import { formatSummary, summarizeViaBackend, suggestTagsViaBackend, transcribeViaBackend } from '@/src/ai/client';
import { attachTag, createTag, getEntry, updateEntry } from '@/src/db/entries';
import { claimNextQueuedAiJob, enqueueAiJob, markAiJobDone, requeueOrFailAiJob } from '@/src/db/jobs';
import type { AiJob, DbOptions, Workspace } from '@/src/db/types';
import { getActiveWorkspaceState } from '@/src/workspace/state';

const MAX_ATTEMPTS = 3;

const runningByWorkspace: Partial<Record<Workspace, boolean>> = {};

function isLikelyNonEnglishTranscript(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  return /[\u0900-\u097F]/.test(text);
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Network request failed') {
      return 'Network request failed. Check EXPO_PUBLIC_AI_API_BASE_URL, local AI server status, and same Wi-Fi between phone and laptop.';
    }
    return error.message;
  }
  return 'Unknown AI processing error';
}

async function syncSuggestedTags(entryId: string, tags: string[], options: DbOptions = {}) {
  let attached = 0;
  const unique = [...new Set(tags.map((name) => name.trim()).filter(Boolean))];

  for (const name of unique) {
    const tag = await createTag(name, options);
    await attachTag(entryId, tag.id, options);
    attached += 1;
  }

  return attached;
}

export async function generateTagsForEntry(entryId: string, options: DbOptions = {}): Promise<{ suggested: number; attached: number }> {
  const entry = await getEntry(entryId, options);
  if (!entry) {
    throw new Error(`Entry ${entryId} not found.`);
  }

  const transcript = entry.transcript?.trim() ?? '';
  const summary = entry.summary?.trim() ?? '';
  if (!transcript && !summary) {
    throw new Error('Add transcript or summary first, then generate tags.');
  }

  try {
    const suggestedTags = await suggestTagsViaBackend({ transcript, summary });
    const attached = await syncSuggestedTags(entry.id, suggestedTags, options);
    await updateEntry(entry.id, { errorMsg: null }, options);

    return { suggested: suggestedTags.length, attached };
  } catch (error) {
    const message = normalizeError(error);
    await updateEntry(entry.id, { errorMsg: `Tag generation failed: ${message}` }, options);
    throw new Error(message);
  }
}

async function processTranscribeJob(job: AiJob, options: DbOptions) {
  const entry = await getEntry(job.entryId, options);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (entry.transcript?.trim() && !isLikelyNonEnglishTranscript(entry.transcript)) {
    await markAiJobDone(job.id, options);
    await enqueueAiJob(entry.id, 'summarize', options);
    await updateEntry(entry.id, { aiStatus: 'queued' }, options);
    return;
  }

  const transcript = await transcribeViaBackend(entry.audioUri);
  await updateEntry(
    entry.id,
    {
      transcript,
      aiStatus: 'transcribed',
      errorMsg: null,
    },
    options
  );

  await markAiJobDone(job.id, options);
  await enqueueAiJob(entry.id, 'summarize', options);
  await updateEntry(entry.id, { aiStatus: 'queued' }, options);
}

async function processSummarizeJob(job: AiJob, options: DbOptions) {
  const entry = await getEntry(job.entryId, options);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (!entry.transcript?.trim()) {
    throw new Error('Cannot summarize without transcript.');
  }

  const summaryData = await summarizeViaBackend(entry.transcript);
  const summary = formatSummary(summaryData.title, summaryData.bullets);

  await updateEntry(
    entry.id,
    {
      summary,
      aiStatus: 'summarized',
      errorMsg: null,
    },
    options
  );

  try {
    await generateTagsForEntry(entry.id, options);
  } catch (error) {
    const message = normalizeError(error);
    await updateEntry(
      entry.id,
      {
        aiStatus: 'summarized',
        errorMsg: `Tag generation failed: ${message}`,
      },
      options
    );
  }

  await markAiJobDone(job.id, options);
}

async function processJob(job: AiJob, options: DbOptions) {
  if (job.type === 'transcribe') {
    await processTranscribeJob(job, options);
    return;
  }

  await processSummarizeJob(job, options);
}

export async function runAiWorker(log?: (message: string) => void, options: DbOptions = {}): Promise<void> {
  const workspace = options.workspace ?? getActiveWorkspaceState();
  if (runningByWorkspace[workspace]) {
    return;
  }

  runningByWorkspace[workspace] = true;
  const scopedOptions: DbOptions = { workspace };

  try {
    while (true) {
      const job = await claimNextQueuedAiJob(scopedOptions);
      if (!job) {
        break;
      }

      try {
        log?.(`[${workspace}] Processing ${job.type} for ${job.entryId}`);
        await processJob(job, scopedOptions);
      } catch (error) {
        const message = normalizeError(error);
        log?.(`[${workspace}] AI job error: ${message}`);
        await requeueOrFailAiJob(job, message, MAX_ATTEMPTS, scopedOptions);
      }
    }
  } finally {
    runningByWorkspace[workspace] = false;
  }
}
