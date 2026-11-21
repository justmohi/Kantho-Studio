import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  filterAndNormalizeModels,
  buildVoiceSettingsPayload,
  sanitizeEmotionTags,
  stripEmotionTags,
  deterministicEnhanceScript,
  detectScriptLanguage,
  splitTextIntoSafeChunks,
  mergeMp3Buffers,
} from './src/utils/ttsEngine.ts';
import type {
  ElevenLabsModel,
  GenerationHistoryItem,
  OutputAudioFormat,
  EmotionMode,
  VoiceSettingsConfig,
} from './src/types/studio.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';

// Persistent storage directories for generated MP3 audio and generation history
const DATA_DIR = path.join(__dirname, '.data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function getElevenLabsApiKey(): string {
  return (process.env.ELEVENLABS_API_KEY || '').trim();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function readHistory(): GenerationHistoryItem[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items: GenerationHistoryItem[]): void {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write history file:', err);
  }
}

// In-memory cache for models and voices to reduce redundant API latency
let cachedModels: { data: ElevenLabsModel[]; timestamp: number } | null = null;
let cachedVoices: { data: any; timestamp: number; queryKey: string } | null = null;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 25000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAccountModels(apiKey: string, forceRefresh = false): Promise<ElevenLabsModel[]> {
  if (!forceRefresh && cachedModels && Date.now() - cachedModels.timestamp < 120_000) {
    return cachedModels.data;
  }

  const response = await fetchWithTimeout(
    `${ELEVENLABS_BASE_URL}/v1/models`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'application/json',
      },
    },
    15000
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      parseElevenLabsError(response.status, errText, 'Failed to fetch ElevenLabs models')
    );
  }

  const rawModels = await response.json();
  const normalized = filterAndNormalizeModels(rawModels);
  cachedModels = { data: normalized, timestamp: Date.now() };
  return normalized;
}

function parseElevenLabsError(status: number, bodyText: string, fallbackMessage: string): string {
  try {
    const parsed = JSON.parse(bodyText);
    const detail = parsed?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return `${detail.message}${detail.status ? ` (${detail.status})` : ''}`;
  } catch {
    // ignore JSON parse error
  }
  if (status === 401) {
    return 'Invalid or unauthorized ElevenLabs API key (HTTP 401). Please verify ELEVENLABS_API_KEY on the server.';
  }
  if (status === 429) {
    return 'ElevenLabs API rate limit or concurrent request limit reached (HTTP 429). Please wait a moment and retry.';
  }
  return `${fallbackMessage} (HTTP ${status})`;
}

/**
 * Uses Gemini (gemini-4-hydrogen) to insert natural ElevenLabs emotion tags into Bengali or English script
 * while strictly preserving every original word, spelling, and language.
 */
async function enhanceScriptWithGemini(
  text: string,
  model?: ElevenLabsModel | null
): Promise<{ enhancedText: string; provider: 'gemini' | 'deterministic' }> {
  const cleanInput = stripEmotionTags(text).trim();
  if (!cleanInput) {
    return { enhancedText: '', provider: 'deterministic' };
  }

  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Insert appropriate ElevenLabs expressive emotion tags into the following script without changing, translating, or removing a single word of the original script:\n\n${cleanInput}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `You are an expert audio director for ElevenLabs v4 Text-to-Speech (specializing in Bangladeshi and Indian Bengali narration as well as English).
Your ONLY job is to insert bracketed emotion/delivery tags into the user's script where emotionally appropriate.

ALLOWED TAGS ONLY:
[whispers], [excited], [curious], [sad], [crying], [angry], [mischievously], [sighs], [laughs], [shouts], [dramatic]

STRICT RULES:
1. NEVER change the original story or wording.
2. NEVER translate Bengali into English or English into Bengali.
3. NEVER transliterate Bengali script.
4. NEVER add invented dialogue or commentary.
5. Preserve exact Bengali Unicode spelling and punctuation (such as ।, ?, !).
6. Do NOT overuse tags — place 1 to 3 tags per sentence or dramatic turn where they genuinely enhance vocal delivery.
7. Return ONLY the enhanced script text with tags inserted, with no markdown fences or explanation.

Example Input:
কিন্তু দরজা খুলতেই সে যা দেখল, তা বিশ্বাস করতে পারছিল না!
Example Output:
[whispers] কিন্তু দরজা খুলতেই... [dramatic] সে যা দেখল, তা বিশ্বাস করতে পারছিল না!`,
        },
      });

      const candidate = (response.text ?? '').trim();
      if (candidate) {
        const sanitized = sanitizeEmotionTags(candidate, model);
        // Verify that Gemini did not strip or translate the original words
        const origWords = cleanInput
          .replace(/[,.!?;:।॥"'"'()…-]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 1);
        const sanitizedClean = stripEmotionTags(sanitized);
        const matchedCount = origWords.filter((w) => sanitizedClean.includes(w)).length;
        const preservationRatio = origWords.length > 0 ? matchedCount / origWords.length : 1;

        if (preservationRatio >= 0.85 && sanitized.includes('[')) {
          return { enhancedText: sanitized, provider: 'gemini' };
        }
      }
    } catch (err) {
      console.warn('Gemini Auto-Enhance fallback to deterministic analyzer:', err);
    }
  }

  const fallback = sanitizeEmotionTags(deterministicEnhanceScript(cleanInput), model);
  return { enhancedText: fallback, provider: 'deterministic' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Server API Configuration Status (Never exposes keys)
  app.get('/api/config/status', (req, res) => {
    const apiKey = getElevenLabsApiKey();
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const simulateMissing = req.query.simulate_missing === '1';

    res.json({
      elevenlabsConfigured: !simulateMissing && Boolean(apiKey && apiKey.startsWith('sk_')),
      geminiConfigured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
      apiBaseUrl: ELEVENLABS_BASE_URL,
    });
  });

  // 2. Official ElevenLabs Models Endpoint (GET /v1/models)
  app.get('/api/elevenlabs/models', async (req, res) => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured on the server.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const forceRefresh = req.query.refresh === 'true';
      const models = await fetchAccountModels(apiKey, forceRefresh);
      res.json({ models });
    } catch (err: any) {
      const message = err?.message || 'Failed to load models from ElevenLabs API.';
      const status = message.includes('401') ? 401 : message.includes('429') ? 429 : 502;
      res.status(status).json({ error: message });
    }
  });

  // 3. Official ElevenLabs Voice Library Endpoint (GET /v2/voices)
  app.get('/api/elevenlabs/voices', async (req, res) => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured on the server.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const pageSize = Math.min(100, Math.max(10, Number(req.query.page_size) || 100));
      const nextPageToken = req.query.next_page_token ? String(req.query.next_page_token) : '';
      const search = req.query.search ? String(req.query.search).trim() : '';
      const category = req.query.category ? String(req.query.category).trim() : '';
      const forceRefresh = req.query.refresh === 'true';

      const queryParams = new URLSearchParams();
      queryParams.set('page_size', String(pageSize));
      queryParams.set('include_total_count', 'true');
      if (nextPageToken) queryParams.set('next_page_token', nextPageToken);
      if (search) queryParams.set('search', search);
      if (category) queryParams.set('category', category);

      const queryKey = queryParams.toString();
      if (
        !forceRefresh &&
        cachedVoices &&
        cachedVoices.queryKey === queryKey &&
        Date.now() - cachedVoices.timestamp < 60_000
      ) {
        res.json(cachedVoices.data);
        return;
      }

      const response = await fetchWithTimeout(
        `${ELEVENLABS_BASE_URL}/v2/voices?${queryKey}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
            Accept: 'application/json',
          },
        },
        20000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          parseElevenLabsError(response.status, errText, 'Failed to fetch ElevenLabs Voice Library')
        );
      }

      const rawData = await response.json();
      const voices = Array.isArray(rawData.voices)
        ? rawData.voices.map((v: any) => ({
            voice_id: v.voice_id,
            name: v.name, // Keep exact original English voice name from ElevenLabs
            category: v.category || 'premade',
            description: v.description || null,
            preview_url: v.preview_url || null,
            labels: v.labels || {},
            verified_languages: Array.isArray(v.verified_languages) ? v.verified_languages : [],
            fine_tuning: v.fine_tuning
              ? { language: v.fine_tuning.language, state: v.fine_tuning.state }
              : undefined,
          }))
        : [];

      const payload = {
        voices,
        has_more: Boolean(rawData.has_more),
        total_count: Number(rawData.total_count ?? voices.length),
        next_page_token: rawData.next_page_token || null,
      };

      cachedVoices = { data: payload, timestamp: Date.now(), queryKey };
      res.json(payload);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch voices from ElevenLabs API.';
      const status = message.includes('401') ? 401 : message.includes('429') ? 429 : 502;
      res.status(status).json({ error: message });
    }
  });

  // 4. AI Auto Emotion Tag Enhancement Endpoint
  app.post('/api/tts/enhance', async (req, res) => {
    try {
      const { text, modelId } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Please provide script text to enhance.' });
        return;
      }

      const apiKey = getElevenLabsApiKey();
      let targetModel: ElevenLabsModel | undefined;
      if (apiKey && modelId) {
        const models = await fetchAccountModels(apiKey).catch(() => []);
        targetModel = models.find((m) => m.model_id === modelId);
      }

      const result = await enhanceScriptWithGemini(text, targetModel);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Failed to enhance script with emotion tags.',
      });
    }
  });

  // 5. Official ElevenLabs Text-to-Speech Generation Endpoint (POST /v1/text-to-speech/{voice_id})
  app.post('/api/tts/generate', async (req, res) => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured on the server.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const {
        originalText,
        enhancedText,
        emotionMode = 'auto',
        voiceId,
        voiceName,
        voiceCategory,
        voiceAccent,
        modelId = 'eleven_v4',
        outputFormat = 'mp3_44100_128',
        voiceSettings,
      }: {
        originalText: string;
        enhancedText?: string;
        emotionMode?: EmotionMode;
        voiceId: string;
        voiceName?: string;
        voiceCategory?: string;
        voiceAccent?: string;
        modelId?: string;
        outputFormat?: OutputAudioFormat;
        voiceSettings?: VoiceSettingsConfig;
      } = req.body || {};

      if (!originalText || typeof originalText !== 'string' || !originalText.trim()) {
        res.status(400).json({ error: 'Input text cannot be empty.' });
        return;
      }

      if (!voiceId || typeof voiceId !== 'string' || !voiceId.trim()) {
        res.status(400).json({ error: 'A valid ElevenLabs voice ID is required.' });
        return;
      }

      // Verify model availability on account — never silently switch models
      const models = await fetchAccountModels(apiKey);
      const selectedModel = models.find((m) => m.model_id === modelId);
      if (!selectedModel) {
        res.status(400).json({
          error: `Model "${modelId}" is not available on this ElevenLabs account.`,
        });
        return;
      }

      // Determine final text to synthesize based on EmotionMode
      let finalScript = originalText.trim();
      if (emotionMode === 'natural') {
        finalScript = stripEmotionTags(originalText);
      } else if (emotionMode === 'manual') {
        finalScript = sanitizeEmotionTags(enhancedText || originalText, selectedModel);
      } else {
        // Auto mode: if user already previewed/edited enhancedText with tags, sanitize and respect their edits
        if (enhancedText && enhancedText.trim() && enhancedText.includes('[')) {
          finalScript = sanitizeEmotionTags(enhancedText, selectedModel);
        } else {
          const enhancedResult = await enhanceScriptWithGemini(originalText, selectedModel);
          finalScript = enhancedResult.enhancedText;
        }
      }

      const languageAnalysis = detectScriptLanguage(originalText);
      const safeVoiceSettings = buildVoiceSettingsPayload(
        voiceSettings || { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
        selectedModel
      );

      // Safe chunking based on the selected model's maximum_text_length_per_request
      const maxChunkChars = Math.min(
        selectedModel.maximum_text_length_per_request || 5000,
        2800
      );
      const chunks = splitTextIntoSafeChunks(finalScript, maxChunkChars);
      if (chunks.length === 0) {
        res.status(400).json({ error: 'No synthesizable text remained after processing.' });
        return;
      }

      const audioBuffers: Uint8Array[] = [];
      const previousRequestIds: string[] = [];

      // Sequential chunk generation with request stitching (previous_request_ids) when supported
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const bodyPayload: Record<string, any> = {
          text: chunkText,
          model_id: selectedModel.model_id,
          voice_settings: safeVoiceSettings,
        };

        if (previousRequestIds.length > 0 && previousRequestIds.length <= 3) {
          bodyPayload.previous_request_ids = previousRequestIds.slice(-3);
        }

        const ttsUrl = `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}?output_format=${encodeURIComponent(outputFormat)}`;

        const ttsRes = await fetchWithTimeout(
          ttsUrl,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify(bodyPayload),
          },
          45000
        );

        if (!ttsRes.ok) {
          const errText = await ttsRes.text().catch(() => '');
          throw new Error(
            parseElevenLabsError(
              ttsRes.status,
              errText,
              `ElevenLabs TTS failed on chunk ${i + 1}/${chunks.length}`
            )
          );
        }

        const reqId = ttsRes.headers.get('request-id');
        if (reqId) {
          previousRequestIds.push(reqId);
        }

        const arrayBuf = await ttsRes.arrayBuffer();
        audioBuffers.push(new Uint8Array(arrayBuf));
      }

      const mergedMp3 = mergeMp3Buffers(audioBuffers);
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const audioFilePath = path.join(AUDIO_DIR, `${generationId}.mp3`);
      fs.writeFileSync(audioFilePath, Buffer.from(mergedMp3));

      const historyItem: GenerationHistoryItem = {
        id: generationId,
        originalText: originalText.trim(),
        enhancedText: finalScript,
        emotionMode,
        voiceName: voiceName || voiceId,
        voiceId,
        voiceCategory,
        voiceAccent,
        modelId: selectedModel.model_id,
        modelName: selectedModel.name,
        outputFormat,
        settings: {
          stability: Number(safeVoiceSettings.stability ?? 0.5),
          similarity_boost: Number(safeVoiceSettings.similarity_boost ?? 0.75),
          speed: Number(safeVoiceSettings.speed ?? 1.0),
          ...(typeof safeVoiceSettings.style === 'number'
            ? { style: safeVoiceSettings.style }
            : {}),
          ...(typeof safeVoiceSettings.use_speaker_boost === 'boolean'
            ? { use_speaker_boost: safeVoiceSettings.use_speaker_boost }
            : {}),
        },
        languageDetected: languageAnalysis.label,
        chunkCount: chunks.length,
        characterCount: finalScript.length,
        audioUrl: `/api/tts/audio/${generationId}`,
        audioSizeBytes: mergedMp3.byteLength,
        createdAt: new Date().toISOString(),
      };

      const existingHistory = readHistory();
      const updatedHistory = [historyItem, ...existingHistory].slice(0, 100);
      writeHistory(updatedHistory);

      res.json({
        generation: historyItem,
      });
    } catch (err: any) {
      const message =
        err?.name === 'AbortError'
          ? 'ElevenLabs API request timed out. Please try again with a shorter passage or retry.'
          : err?.message || 'Audio generation failed.';
      const status = message.includes('401') ? 401 : message.includes('429') ? 429 : 502;
      res.status(status).json({ error: message });
    }
  });

  // 6. Serve Generated MP3 Audio Files
  app.get('/api/tts/audio/:id', (req, res) => {
    const rawId = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(AUDIO_DIR, `${rawId}.mp3`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Audio file not found.' });
      return;
    }

    const download = req.query.download === '1';
    res.setHeader('Content-Type', 'audio/mpeg');
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="kantho-${rawId}.mp3"`);
    }
    fs.createReadStream(filePath).pipe(res);
  });

  // 7. Generation History Endpoints
  app.get('/api/tts/history', (_req, res) => {
    const items = readHistory();
    res.json({ history: items });
  });

  app.delete('/api/tts/history/:id', (req, res) => {
    const rawId = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const items = readHistory();
    const filtered = items.filter((item) => item.id !== rawId);
    writeHistory(filtered);

    const filePath = path.join(AUDIO_DIR, `${rawId}.mp3`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    res.json({ success: true, history: filtered });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kantho AI Voice Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
