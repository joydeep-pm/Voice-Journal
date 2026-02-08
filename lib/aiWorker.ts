import { formatSummary, summarizeTranscriptWithOpenAI, transcribeAudioWithOpenAI } from '@/lib/openai';
import {
  claimNextQueuedAiJob,
  enqueueAiJob,
  getEntry,
  markAiJobDone,
  requeueOrFailAiJob,
  updateEntry,
} from '@/lib/repository';
import type { AiJob } from '@/lib/types';

const MAX_RETRIES = 3;

let running = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown AI processing error';
}

async function handleTranscription(job: AiJob) {
  const entry = await getEntry(job.entryId);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (entry.transcript?.trim()) {
    await markAiJobDone(job.id);
    await enqueueAiJob(job.entryId, 'summarize');
    await updateEntry(job.entryId, { aiStatus: 'queued' });
    return;
  }

  const transcript = await transcribeAudioWithOpenAI(entry.audioUri);

  await updateEntry(job.entryId, {
    transcript,
    aiStatus: 'processing',
    aiError: null,
  });

  await markAiJobDone(job.id);
  await enqueueAiJob(job.entryId, 'summarize');
  await updateEntry(job.entryId, { aiStatus: 'queued' });
}

async function handleSummarization(job: AiJob) {
  const entry = await getEntry(job.entryId);
  if (!entry) {
    throw new Error(`Entry ${job.entryId} not found.`);
  }

  if (!entry.transcript?.trim()) {
    throw new Error('Entry is missing transcript content.');
  }

  const summary = await summarizeTranscriptWithOpenAI(entry.transcript);

  await updateEntry(job.entryId, {
    title: summary.title,
    summary: formatSummary(summary.title, summary.bullets),
    aiStatus: 'done',
    aiError: null,
  });

  await markAiJobDone(job.id);
}

async function processJob(job: AiJob) {
  if (job.kind === 'transcribe') {
    await handleTranscription(job);
    return;
  }

  await handleSummarization(job);
}

export async function runAiWorker(log?: (message: string) => void) {
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
        log?.(`Processing ${job.kind} for entry ${job.entryId}`);
        await processJob(job);
      } catch (error) {
        const message = normalizeError(error);
        log?.(`AI job failed: ${message}`);
        await requeueOrFailAiJob(job, message, MAX_RETRIES);

        if (job.attemptCount + 1 < MAX_RETRIES) {
          await sleep(1000);
        }
      }
    }
  } finally {
    running = false;
  }
}
