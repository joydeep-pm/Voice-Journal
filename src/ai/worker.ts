import { formatSummary, summarizeViaBackend, suggestTagsViaBackend, transcribeViaBackend } from '@/src/ai/client';
import { attachTag, createTag, getEntry, updateEntry } from '@/src/db/entries';
import { claimNextQueuedAiJob, enqueueAiJob, markAiJobDone, requeueOrFailAiJob } from '@/src/db/jobs';
import type { AiJob } from '@/src/db/types';

const MAX_ATTEMPTS = 3;

let running = false;

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Network request failed') {
      return 'Network request failed. Check EXPO_PUBLIC_AI_API_BASE_URL, local AI server status, and same Wi-Fi between phone and laptop.';
    }
    return error.message;
  }
  return 'Unknown AI processing error';
}

async function syncSuggestedTags(entryId: string, tags: string[]) {
  let attached = 0;
  const unique = [...new Set(tags.map((name) => name.trim()).filter(Boolean))];

  for (const name of unique) {
    const tag = await createTag(name);
    await attachTag(entryId, tag.id);
    attached += 1;
  }

  return attached;
}

export async function generateTagsForEntry(entryId: string): Promise<{ suggested: number; attached: number }> {
  const entry = await getEntry(entryId);
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
    const attached = await syncSuggestedTags(entry.id, suggestedTags);
    await updateEntry(entry.id, { errorMsg: null });

    return { suggested: suggestedTags.length, attached };
  } catch (error) {
    const message = normalizeError(error);
    await updateEntry(entry.id, { errorMsg: `Tag generation failed: ${message}` });
    throw new Error(message);
  }
}

async function processTranscribeJob(job: AiJob) {
  const entry = await getEntry(job.entryId);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (entry.transcript?.trim()) {
    await markAiJobDone(job.id);
    await enqueueAiJob(entry.id, 'summarize');
    await updateEntry(entry.id, { aiStatus: 'queued' });
    return;
  }

  const transcript = await transcribeViaBackend(entry.audioUri);
  await updateEntry(entry.id, {
    transcript,
    aiStatus: 'transcribed',
    errorMsg: null,
  });

  await markAiJobDone(job.id);
  await enqueueAiJob(entry.id, 'summarize');
  await updateEntry(entry.id, { aiStatus: 'queued' });
}

async function processSummarizeJob(job: AiJob) {
  const entry = await getEntry(job.entryId);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (!entry.transcript?.trim()) {
    throw new Error('Cannot summarize without transcript.');
  }

  const summaryData = await summarizeViaBackend(entry.transcript);
  const summary = formatSummary(summaryData.title, summaryData.bullets);

  await updateEntry(entry.id, {
    summary,
    aiStatus: 'summarized',
    errorMsg: null,
  });

  try {
    await generateTagsForEntry(entry.id);
  } catch (error) {
    const message = normalizeError(error);
    await updateEntry(entry.id, {
      aiStatus: 'summarized',
      errorMsg: `Tag generation failed: ${message}`,
    });
  }

  await markAiJobDone(job.id);
}

async function processJob(job: AiJob) {
  if (job.type === 'transcribe') {
    await processTranscribeJob(job);
    return;
  }

  await processSummarizeJob(job);
}

export async function runAiWorker(log?: (message: string) => void): Promise<void> {
  if (running) {
    return;
  }

  running = true;

  try {
    while (true) {
      const job = await claimNextQueuedAiJob();
      if (!job) {
        break;
      }

      try {
        log?.(`Processing ${job.type} for ${job.entryId}`);
        await processJob(job);
      } catch (error) {
        const message = normalizeError(error);
        log?.(`AI job error: ${message}`);
        await requeueOrFailAiJob(job, message, MAX_ATTEMPTS);
      }
    }
  } finally {
    running = false;
  }
}
