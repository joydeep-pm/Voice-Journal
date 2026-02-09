const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const APP_AI_TOKEN = process.env.APP_AI_TOKEN;
const PORT = Number(process.env.PORT || process.env.AI_LOCAL_PORT || 8787);

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}

async function translateToEnglishIfNeeded(text) {
  const source = String(text || '').trim();
  if (!source) {
    return source;
  }

  if (!hasDevanagari(source)) {
    return source;
  }

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Translate the provided transcript into natural English. Return strict JSON with one key: {"text": "..."}',
      },
      { role: 'user', content: source },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const translated = String(parsed.text || '').trim();
  return translated || source;
}

function requireAppToken(req, res, next) {
  if (!APP_AI_TOKEN) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== APP_AI_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

app.get('/ai/health', (_req, res) => {
  res.json({ ok: true, service: 'voice-journal-ai-local' });
});

app.post('/ai/transcribe', requireAppToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Missing audio file (multipart field: file).' });
    }

    const uploadFile = await toFile(req.file.buffer, req.file.originalname || 'entry.m4a', {
      type: req.file.mimetype || 'audio/m4a',
    });

    const translation = await client.audio.translations.create({
      model: 'whisper-1',
      file: uploadFile,
    });

    const transcript = await translateToEnglishIfNeeded(translation.text || '');
    return res.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return res.status(500).json({ error: message });
  }
});

app.post('/ai/summarize', requireAppToken, async (req, res) => {
  try {
    const transcript = String(req.body?.transcript || '').trim();
    if (!transcript) {
      return res.status(400).json({ error: 'Missing transcript.' });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You summarize journal transcripts in English only. Return strict JSON with keys: title (string), bullets (array of <=5 short strings). If input is non-English, translate implicitly and still output English.',
        },
        { role: 'user', content: transcript },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const title = String(parsed.title || '').trim();
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : [];

    if (!title) {
      return res.status(500).json({ error: 'Model returned empty title.' });
    }

    return res.json({ title, bullets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summarization failed';
    return res.status(500).json({ error: message });
  }
});

app.post('/ai/tags', requireAppToken, async (req, res) => {
  try {
    const transcript = String(req.body?.transcript || '').trim();
    const summary = String(req.body?.summary || '').trim();

    if (!transcript && !summary) {
      return res.status(400).json({ error: 'Missing transcript/summary.' });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Return strict JSON: {"tags": string[]}. Provide 3-8 short lowercase English tags, no # prefix, no duplicates, relevant to the journal content. If input is non-English, translate conceptually and still return English tags.',
        },
        { role: 'user', content: `Transcript:\n${transcript}\n\nSummary:\n${summary}` },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((item) => String(item).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return res.json({ tags: [...new Set(tags)] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tag generation failed';
    return res.status(500).json({ error: message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI server listening on http://0.0.0.0:${PORT}`);
});
