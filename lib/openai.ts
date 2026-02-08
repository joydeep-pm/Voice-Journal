const OPENAI_API_BASE = 'https://api.openai.com/v1';
const TRANSCRIBE_MODEL = 'whisper-1';
const SUMMARY_MODEL = 'gpt-4o-mini';

function getApiKey() {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY.');
  }
  return key;
}

async function parseError(response: Response) {
  try {
    const data = await response.json();
    if (data?.error?.message) {
      return data.error.message as string;
    }
  } catch {
    // ignore json parsing errors
  }

  try {
    return await response.text();
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function transcribeAudioWithOpenAI(audioUri: string): Promise<string> {
  const apiKey = getApiKey();

  const form = new FormData();
  form.append('model', TRANSCRIBE_MODEL);
  form.append('file', {
    uri: audioUri,
    name: 'entry.m4a',
    type: 'audio/m4a',
  } as any);

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text?.trim()) {
    throw new Error('Transcription did not return text.');
  }

  return data.text.trim();
}

export async function summarizeTranscriptWithOpenAI(transcript: string): Promise<{ title: string; bullets: string[] }> {
  const apiKey = getApiKey();

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You summarize journal transcripts. Output strict JSON with keys: title (string), bullets (array of <=5 short bullet strings).',
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;

  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Summary response was empty.');
  }

  let parsed: { title?: string; bullets?: unknown };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Summary response was not valid JSON.');
  }

  const title = String(parsed.title ?? '').trim();
  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!title) {
    throw new Error('Summary title was missing.');
  }

  return {
    title,
    bullets,
  };
}

export function formatSummary(title: string, bullets: string[]): string {
  const lines = [title, ...bullets.map((bullet) => `- ${bullet}`)];
  return lines.join('\n');
}
