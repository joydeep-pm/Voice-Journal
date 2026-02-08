const AI_API_BASE_URL = process.env.EXPO_PUBLIC_AI_API_BASE_URL;
const AI_API_TOKEN = process.env.EXPO_PUBLIC_AI_API_TOKEN;

function ensureBaseUrl() {
  if (!AI_API_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_AI_API_BASE_URL. Configure your backend AI endpoint URL.');
  }

  return AI_API_BASE_URL.replace(/\/$/, '');
}

export function getAiBackendBaseUrl(): string {
  return ensureBaseUrl();
}

async function parseError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    if (json?.error && typeof json.error === 'string') {
      return json.error;
    }
    if (json?.message && typeof json.message === 'string') {
      return json.message;
    }
  } catch {
    // ignore parse errors
  }

  try {
    return await response.text();
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (AI_API_TOKEN) {
    headers.Authorization = `Bearer ${AI_API_TOKEN}`;
  }
  return headers;
}

async function fetchOrThrowNetwork(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Network request failed';
    throw new Error(`Cannot reach AI backend at ${url} (${reason}). Is local AI server running and phone on same Wi-Fi?`);
  }
}

export async function checkAiBackendHealth(): Promise<{ ok: boolean; service?: string }> {
  const base = ensureBaseUrl();
  const response = await fetchOrThrowNetwork(`${base}/health`, {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { ok?: boolean; service?: string };
  if (!data.ok) {
    throw new Error('AI backend health check returned not ok.');
  }

  return { ok: true, service: data.service };
}

export async function transcribeViaBackend(audioUri: string): Promise<string> {
  const base = ensureBaseUrl();

  const form = new FormData();
  form.append('file', {
    uri: audioUri,
    name: 'entry.m4a',
    type: 'audio/m4a',
  } as any);

  const response = await fetchOrThrowNetwork(`${base}/transcribe`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { transcript?: string; text?: string };
  const transcript = (data.transcript ?? data.text ?? '').trim();
  if (!transcript) {
    throw new Error('Backend returned empty transcript.');
  }

  return transcript;
}

export async function summarizeViaBackend(transcript: string): Promise<{ title: string; bullets: string[] }> {
  const base = ensureBaseUrl();

  const response = await fetchOrThrowNetwork(`${base}/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { title?: string; bullets?: unknown };

  const title = String(data.title ?? '').trim();
  const bullets = Array.isArray(data.bullets)
    ? data.bullets.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
    : [];

  if (!title) {
    throw new Error('Backend returned empty summary title.');
  }

  return { title, bullets };
}

export async function suggestTagsViaBackend(input: { transcript: string; summary?: string | null }): Promise<string[]> {
  const base = ensureBaseUrl();

  const response = await fetchOrThrowNetwork(`${base}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { tags?: unknown };
  if (!Array.isArray(data.tags)) {
    return [];
  }

  return data.tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function formatSummary(title: string, bullets: string[]): string {
  return [title, ...bullets.map((line) => `- ${line}`)].join('\n');
}
