import type {
  ElevenLabsModel,
  EmotionTagDefinition,
  ScriptLanguageAnalysis,
  SupportedModelSettings,
  VoiceSettingsConfig,
} from '../types/studio';

export const PREFERRED_MODEL_ORDER = [
  'eleven_v4',
  'eleven_v4_turbo',
  'eleven_v3',
  'eleven_multilingual_v2',
] as const;

export const SUPPORTED_EMOTION_TAGS: EmotionTagDefinition[] = [
  {
    tag: '[whispers]',
    label: 'Whispers',
    bengaliLabel: 'ফিসফিস করে',
    category: 'delivery',
    description: 'Hushed, intimate or suspenseful vocal delivery',
  },
  {
    tag: '[excited]',
    label: 'Excited',
    bengaliLabel: 'উত্তেজিত',
    category: 'emotion',
    description: 'High energy, enthusiastic tone',
  },
  {
    tag: '[curious]',
    label: 'Curious',
    bengaliLabel: 'কৌতূহলী',
    category: 'emotion',
    description: 'Inquisitive, wondering inflection',
  },
  {
    tag: '[sad]',
    label: 'Sad',
    bengaliLabel: 'দুঃখিত',
    category: 'emotion',
    description: 'Melancholic, sorrowful voice',
  },
  {
    tag: '[crying]',
    label: 'Crying',
    bengaliLabel: 'কান্নাজড়িত',
    category: 'reaction',
    description: 'Tearful, breaking vocal emotion',
  },
  {
    tag: '[angry]',
    label: 'Angry',
    bengaliLabel: 'রাগান্বিত',
    category: 'emotion',
    description: 'Intense, forceful delivery',
  },
  {
    tag: '[mischievously]',
    label: 'Mischievously',
    bengaliLabel: 'দুষ্টুমির সুরে',
    category: 'delivery',
    description: 'Playful, scheming inflection',
  },
  {
    tag: '[sighs]',
    label: 'Sighs',
    bengaliLabel: 'দীর্ঘশ্বাস',
    category: 'reaction',
    description: 'Audible breath of relief, exhaustion, or sorrow',
  },
  {
    tag: '[laughs]',
    label: 'Laughs',
    bengaliLabel: 'হাসি',
    category: 'reaction',
    description: 'Natural chuckle or laughter',
  },
  {
    tag: '[shouts]',
    label: 'Shouts',
    bengaliLabel: 'চিৎকার করে',
    category: 'delivery',
    description: 'Loud, urgent exclamation',
  },
  {
    tag: '[dramatic]',
    label: 'Dramatic',
    bengaliLabel: 'নাটকীয়',
    category: 'delivery',
    description: 'Heightened storytelling gravity and suspense',
  },
];

export const ALLOWED_TAG_SET = new Set(
  SUPPORTED_EMOTION_TAGS.map((item) => item.tag.toLowerCase())
);

/**
 * Analyzes input script for Bengali Unicode (\u0980-\u09FF) and Latin characters.
 * Never alters, translates, or transliterates the text.
 */
export function detectScriptLanguage(text: string): ScriptLanguageAnalysis {
  const cleanText = stripEmotionTags(text).trim();
  if (!cleanText) {
    return {
      primaryLanguage: 'other',
      label: 'Awaiting Input',
      hasBengaliUnicode: false,
      hasEnglishLatin: false,
      bengaliCharCount: 0,
      latinCharCount: 0,
      totalChars: 0,
      wordCount: 0,
      bengaliPercentage: 0,
      estimatedDurationSeconds: 0,
    };
  }

  let bengaliCharCount = 0;
  let latinCharCount = 0;

  for (const ch of cleanText) {
    const code = ch.codePointAt(0) ?? 0;
    // Bengali Unicode block: U+0980 to U+09FF (includes दांড়ি U+0964 / U+0965 common in Bengali prose)
    if ((code >= 0x0980 && code <= 0x09ff) || code === 0x0964 || code === 0x0965) {
      bengaliCharCount++;
    } else if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a)) {
      latinCharCount++;
    }
  }

  const alphaTotal = bengaliCharCount + latinCharCount;
  const bengaliPercentage =
    alphaTotal > 0 ? Math.round((bengaliCharCount / alphaTotal) * 100) : 0;

  const hasBengaliUnicode = bengaliCharCount > 0;
  const hasEnglishLatin = latinCharCount > 0;

  let primaryLanguage: ScriptLanguageAnalysis['primaryLanguage'] = 'other';
  let label = 'Multilingual Unicode';

  if (hasBengaliUnicode && hasEnglishLatin) {
    if (bengaliPercentage >= 75) {
      primaryLanguage = 'bn';
      label = 'Bengali (বাংলা) · Primary';
    } else if (bengaliPercentage <= 25) {
      primaryLanguage = 'en';
      label = 'English · With Bengali Terms';
    } else {
      primaryLanguage = 'mixed';
      label = `Bengali + English (${bengaliPercentage}% বাংলা)`;
    }
  } else if (hasBengaliUnicode) {
    primaryLanguage = 'bn';
    label = 'Bengali (বাংলা) · Unicode Detected';
  } else if (hasEnglishLatin) {
    primaryLanguage = 'en';
    label = 'English · Latin Script';
  }

  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  // Average narration pace ~130 words per minute
  const estimatedDurationSeconds = Math.max(1, Math.round((wordCount / 130) * 60));

  return {
    primaryLanguage,
    label,
    hasBengaliUnicode,
    hasEnglishLatin,
    bengaliCharCount,
    latinCharCount,
    totalChars: text.length,
    wordCount,
    bengaliPercentage,
    estimatedDurationSeconds,
  };
}

/**
 * Filters raw models from GET /v1/models to TTS-capable models and orders the core 4 models first.
 */
export function filterAndNormalizeModels(rawModels: any[]): ElevenLabsModel[] {
  if (!Array.isArray(rawModels)) return [];

  const ttsModels = rawModels.filter((m) => m && m.can_do_text_to_speech === true);

  // Check which models exist on the account; prioritize the 4 primary TTS models
  const normalized: ElevenLabsModel[] = ttsModels.map((m) => {
    const languages: { language_id: string; name: string }[] = Array.isArray(m.languages)
      ? m.languages
      : [];
    const hasExplicitBn = languages.some((l) => l.language_id === 'bn');
    // eleven_v4, eleven_v4_turbo, eleven_v3 explicitly include 'bn'; eleven_multilingual_v2 also handles multilingual scripts
    const supportsBengali =
      hasExplicitBn ||
      m.model_id === 'eleven_v4' ||
      m.model_id === 'eleven_v4_turbo' ||
      m.model_id === 'eleven_v3' ||
      m.model_id === 'eleven_multilingual_v2';

    return {
      model_id: String(m.model_id),
      name: String(m.name || m.model_id),
      description: String(m.description || ''),
      can_do_text_to_speech: Boolean(m.can_do_text_to_speech),
      can_use_style: Boolean(m.can_use_style),
      can_use_speaker_boost: Boolean(m.can_use_speaker_boost),
      maximum_text_length_per_request: Number(m.maximum_text_length_per_request || 5000),
      languages,
      supportsBengali,
      isPreferred: m.model_id === 'eleven_v4',
    };
  });

  // Sort so the 4 target models appear first in exact preferred order, followed by other available TTS models
  normalized.sort((a, b) => {
    const idxA = PREFERRED_MODEL_ORDER.indexOf(a.model_id as any);
    const idxB = PREFERRED_MODEL_ORDER.indexOf(b.model_id as any);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return normalized;
}

/**
 * Returns which voice settings and capabilities are supported by the selected ElevenLabs model.
 */
export function getSupportedSettingsForModel(
  model: ElevenLabsModel | undefined | null
): SupportedModelSettings {
  if (!model) {
    return {
      stability: true,
      similarity_boost: true,
      speed: true,
      style: false,
      use_speaker_boost: false,
      maxCharacters: 10000,
      supportsEmotionTags: true,
    };
  }

  // Expressive bracket tags ([whispers], [excited], etc.) are natively interpreted by Eleven v4, v4 Turbo, v3, and Multilingual v2
  const supportsEmotionTags =
    model.model_id.startsWith('eleven_v4') ||
    model.model_id.startsWith('eleven_v3') ||
    model.model_id === 'eleven_multilingual_v2';

  return {
    stability: true,
    similarity_boost: true,
    speed: true,
    style: Boolean(model.can_use_style),
    use_speaker_boost: Boolean(model.can_use_speaker_boost),
    maxCharacters: model.maximum_text_length_per_request || 5000,
    supportsEmotionTags,
  };
}

/**
 * Constructs a clean voice_settings object containing ONLY parameters supported by the target model.
 */
export function buildVoiceSettingsPayload(
  settings: VoiceSettingsConfig,
  model: ElevenLabsModel | undefined | null
): Record<string, number | boolean> {
  const supported = getSupportedSettingsForModel(model);
  const payload: Record<string, number | boolean> = {
    stability: clampNumber(settings.stability, 0, 1, 0.5),
    similarity_boost: clampNumber(settings.similarity_boost, 0, 1, 0.75),
  };

  if (supported.speed && typeof settings.speed === 'number') {
    payload.speed = clampNumber(settings.speed, 0.7, 1.2, 1.0);
  }

  if (supported.style && typeof settings.style === 'number') {
    payload.style = clampNumber(settings.style, 0, 1, 0);
  }

  if (supported.use_speaker_boost && typeof settings.use_speaker_boost === 'boolean') {
    payload.use_speaker_boost = settings.use_speaker_boost;
  }

  return payload;
}

function clampNumber(val: number, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.min(max, Math.max(min, Number(val.toFixed(2))));
}

/**
 * Strips all bracketed emotion tags from a script (used for Natural mode or clean word counting).
 */
export function stripEmotionTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[[a-zA-Z_\s-]+\]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sanitizes a script so ONLY supported ElevenLabs emotion tags remain,
 * stripping any unsupported or hallucinated bracket tags while preserving all Bengali/English text untouched.
 */
export function sanitizeEmotionTags(
  text: string,
  model?: ElevenLabsModel | null
): string {
  if (!text) return '';
  const supported = getSupportedSettingsForModel(model);
  if (!supported.supportsEmotionTags) {
    return stripEmotionTags(text);
  }

  return text
    .replace(/\[([^\]]+)\]/g, (fullMatch, inner: string) => {
      const normalized = `[${inner.trim().toLowerCase()}]`;
      if (ALLOWED_TAG_SET.has(normalized)) {
        return normalized;
      }
      // Map common synonyms safely or remove unsupported tag
      const synonymMap: Record<string, string> = {
        '[whisper]': '[whispers]',
        '[whispering]': '[whispers]',
        '[sigh]': '[sighs]',
        '[laugh]': '[laughs]',
        '[laughing]': '[laughs]',
        '[shout]': '[shouts]',
        '[shouting]': '[shouts]',
        '[cry]': '[crying]',
        '[mischievous]': '[mischievously]',
        '[curiously]': '[curious]',
        '[sadly]': '[sad]',
        '[angrily]': '[angry]',
        '[excitedly]': '[excited]',
      };
      if (synonymMap[normalized]) {
        return synonymMap[normalized];
      }
      return '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Deterministic rule-based emotion tag enhancer for Bengali and English scripts.
 * Used as a fast local preview or fallback when Gemini is not invoked, ensuring
 * zero translation, zero altered words, and authentic Bengali punctuation awareness.
 */
export function deterministicEnhanceScript(text: string): string {
  const clean = stripEmotionTags(text);
  if (!clean) return '';

  // Split into sentences preserving Bengali দাড়ি (।), ?, !, and English ., ?, !
  const parts = clean.match(/[^।.?!]+[।.?!]*\s*/g) || [clean];
  let tagCount = 0;
  const maxTags = Math.max(2, Math.ceil(parts.length * 0.6));

  const enhancedParts = parts.map((sentence, idx) => {
    const trimmed = sentence.trim();
    if (!trimmed || tagCount >= maxTags) return sentence;

    const lower = trimmed.toLowerCase();

    // Suspense / night / mystery / door opening in Bengali or English
    if (
      /গভীর রাত|হঠাৎ|অদ্ভুত|রহস্য|অন্ধকার|চুপিসারে|ফিসফিস|দরজা খুলতেই|নিঃশব্দে|whisper|midnight|suddenly|strange|shadow/.test(
        lower
      )
    ) {
      tagCount++;
      if (trimmed.includes('!') && /বিশ্বাস করতে পারছিল না|অবাক|দেখল/.test(lower)) {
        // Split clause if comma or দরজা খুলতেই exists
        if (trimmed.includes(',')) {
          const [firstClause, ...rest] = trimmed.split(',');
          return `[whispers] ${firstClause.trim()}... [dramatic] ${rest.join(',').trim()} `;
        }
        return `[dramatic] ${trimmed} `;
      }
      return `[whispers] ${trimmed} `;
    }

    // Tears / crying
    if (/কান্না|কাঁদতে|অশ্রু|চোখের জল|crying|tears|wept/.test(lower)) {
      tagCount++;
      return `[crying] ${trimmed} `;
    }

    // Sadness / grief / sigh
    if (/দুঃখ|কষ্ট|হতাশ|মন খারাপ|দীর্ঘশ্বাস|বিদায়| একা |sad|sorrow|grief|lonely/.test(lower)) {
      tagCount++;
      return `[sad] ${trimmed} `;
    }

    // Anger / shouting
    if (/রাগ|ক্ষুব্ধ|চিৎকার|ধমক|অসম্ভব|সাবধান|angry|furious|shouted/.test(lower)) {
      tagCount++;
      return trimmed.endsWith('!') ? `[shouts] ${trimmed} ` : `[angry] ${trimmed} `;
    }

    // Laughter / joy
    if (/হাসি|হেসে|মজা|আনন্দ|দারুণ|চমৎকার|উৎসব|laugh|joy|wonderful|amazing/.test(lower)) {
      tagCount++;
      return /হাসি|হেসে|laugh/.test(lower)
        ? `[laughs] ${trimmed} `
        : `[excited] ${trimmed} `;
    }

    // Question / curiosity
    if (trimmed.endsWith('?') || /কেন|কীভাবে|কে সে|কী হয়েছিল|wonder|who could/.test(lower)) {
      tagCount++;
      return `[curious] ${trimmed} `;
    }

    // Exclamation / dramatic climax
    if (trimmed.endsWith('!')) {
      tagCount++;
      return `[excited] ${trimmed} `;
    }

    // First sentence fallback if nothing matched yet
    if (idx === 0 && parts.length === 1) {
      tagCount++;
      return `[curious] ${trimmed}`;
    }

    return sentence;
  });

  return enhancedParts.join('').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Validates text, voice, and model compatibility before starting audio synthesis.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  detectedLanguage: ScriptLanguageAnalysis;
}

export function validateGenerationRequest(params: {
  text: string;
  voiceId: string;
  model: ElevenLabsModel | undefined | null;
}): ValidationResult {
  const { text, voiceId, model } = params;
  const cleanText = stripEmotionTags(text).trim();
  const detectedLanguage = detectScriptLanguage(text);

  if (!cleanText) {
    return {
      valid: false,
      error: 'Please enter Bengali or English script text before generating audio.',
      detectedLanguage,
    };
  }

  if (!voiceId || !voiceId.trim()) {
    return {
      valid: false,
      error: 'Please select an ElevenLabs voice from the Voice Library.',
      detectedLanguage,
    };
  }

  if (!model) {
    return {
      valid: false,
      error: 'Please select a valid ElevenLabs synthesis model.',
      detectedLanguage,
    };
  }

  if (!model.can_do_text_to_speech) {
    return {
      valid: false,
      error: `Selected model "${model.name}" (${model.model_id}) does not support Text-to-Speech synthesis.`,
      detectedLanguage,
    };
  }

  let warning: string | undefined;
  const hasExplicitBn = model.languages?.some((l) => l.language_id === 'bn');
  if (detectedLanguage.hasBengaliUnicode && !hasExplicitBn) {
    warning = `Note: "${model.name}" does not list explicit Bengali (bn) metadata. For the most natural Bangladeshi & Indian Bengali pronunciation, "Eleven v4" (eleven_v4) or "Eleven v3" (eleven_v3) is recommended.`;
  }

  return {
    valid: true,
    warning,
    detectedLanguage,
  };
}

/**
 * Safely splits long text into chunks that respect the selected model's character limit
 * without breaking Bengali/English words or splitting mid-sentence.
 */
export function splitTextIntoSafeChunks(text: string, maxCharsPerChunk = 2500): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const safeLimit = Math.max(200, Math.min(maxCharsPerChunk, 9500));

  if (trimmed.length <= safeLimit) {
    return [trimmed];
  }

  // Split by Bengali দাড়ি (।), double दांড়ি (॥), newlines, or standard sentence terminators (. ? !)
  const sentences = trimmed.match(/[^।॥.?!\n]+[।॥.?!\n]*\s*/g) || [trimmed];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    if (s.length > safeLimit) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Split oversized single sentence along words
      const words = s.split(/\s+/);
      let wordChunk = '';
      for (const word of words) {
        if ((wordChunk + ' ' + word).trim().length > safeLimit) {
          if (wordChunk.trim()) chunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
        }
      }
      if (wordChunk.trim()) {
        currentChunk = wordChunk.trim();
      }
    } else if ((currentChunk + ' ' + s).trim().length > safeLimit) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = s;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${s}` : s;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Merges multiple MP3 Uint8Array buffers cleanly by stripping duplicate ID3v2 headers
 * and ID3v1 footers on subsequent chunks so playback is seamless without glitches.
 */
export function mergeMp3Buffers(buffers: Uint8Array[]): Uint8Array {
  if (buffers.length === 0) return new Uint8Array(0);
  if (buffers.length === 1) return buffers[0];

  const processedParts: Uint8Array[] = buffers.map((buf, index) => {
    let start = 0;
    let end = buf.length;

    // Strip ID3v2 header from chunks after the first chunk
    if (
      index > 0 &&
      buf.length > 10 &&
      buf[0] === 0x49 && // 'I'
      buf[1] === 0x44 && // 'D'
      buf[2] === 0x33 // '3'
    ) {
      // Synchsafe 28-bit integer size in bytes 6..9
      const size =
        ((buf[6] & 0x7f) << 21) |
        ((buf[7] & 0x7f) << 14) |
        ((buf[8] & 0x7f) << 7) |
        (buf[9] & 0x7f);
      const headerTotal = 10 + size;
      if (headerTotal < buf.length) {
        start = headerTotal;
      }
    }

    // Strip ID3v1 128-byte trailer ('TAG') from chunks before the last chunk
    if (
      index < buffers.length - 1 &&
      end - start > 128 &&
      buf[end - 128] === 0x54 && // 'T'
      buf[end - 127] === 0x41 && // 'A'
      buf[end - 126] === 0x47 // 'G'
    ) {
      end -= 128;
    }

    return buf.subarray(start, end);
  });

  const totalLength = processedParts.reduce((acc, part) => acc + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of processedParts) {
    merged.set(part, offset);
    offset += part.length;
  }

  return merged;
}
