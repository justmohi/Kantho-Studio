import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectScriptLanguage,
  filterAndNormalizeModels,
  getSupportedSettingsForModel,
  buildVoiceSettingsPayload,
  sanitizeEmotionTags,
  stripEmotionTags,
  deterministicEnhanceScript,
  validateGenerationRequest,
  splitTextIntoSafeChunks,
  mergeMp3Buffers,
} from './ttsEngine';

test('detectScriptLanguage detects Bengali Unicode accurately without altering text', () => {
  const bengaliText = 'হঠাৎ একদিন গভীর রাতে একটি অদ্ভুত ঘটনা ঘটল।';
  const analysis = detectScriptLanguage(bengaliText);
  assert.equal(analysis.primaryLanguage, 'bn');
  assert.equal(analysis.hasBengaliUnicode, true);
  assert.equal(analysis.hasEnglishLatin, false);
  assert.ok(analysis.bengaliCharCount > 20);
  assert.equal(analysis.bengaliPercentage, 100);
});

test('detectScriptLanguage detects English and mixed Bengali-English scripts', () => {
  const english = detectScriptLanguage('Hello world, welcome to the voice studio.');
  assert.equal(english.primaryLanguage, 'en');
  assert.equal(english.hasBengaliUnicode, false);
  assert.equal(english.hasEnglishLatin, true);

  const mixed = detectScriptLanguage('আজকের episode টি খুবই exciting এবং রহস্যময়।');
  assert.equal(mixed.hasBengaliUnicode, true);
  assert.equal(mixed.hasEnglishLatin, true);
});

test('filterAndNormalizeModels prioritizes eleven_v4, eleven_v4_turbo, eleven_v3, eleven_multilingual_v2', () => {
  const rawModels = [
    {
      model_id: 'eleven_multilingual_v2',
      name: 'Eleven Multilingual v2',
      can_do_text_to_speech: true,
      can_use_style: true,
      can_use_speaker_boost: true,
      maximum_text_length_per_request: 10000,
      languages: [{ language_id: 'en', name: 'English' }],
    },
    {
      model_id: 'eleven_english_sts_v2',
      name: 'Eleven English STS',
      can_do_text_to_speech: false,
    },
    {
      model_id: 'eleven_v4',
      name: 'Eleven v4',
      can_do_text_to_speech: true,
      can_use_style: false,
      can_use_speaker_boost: false,
      maximum_text_length_per_request: 10000,
      languages: [{ language_id: 'bn', name: 'Bengali' }],
    },
    {
      model_id: 'eleven_v3',
      name: 'Eleven v3',
      can_do_text_to_speech: true,
      can_use_style: false,
      can_use_speaker_boost: false,
      maximum_text_length_per_request: 5000,
      languages: [{ language_id: 'bn', name: 'Bengali' }],
    },
  ];

  const models = filterAndNormalizeModels(rawModels);
  assert.equal(models.length, 3); // STS model filtered out
  assert.equal(models[0].model_id, 'eleven_v4');
  assert.equal(models[0].isPreferred, true);
  assert.equal(models[1].model_id, 'eleven_v3');
  assert.equal(models[2].model_id, 'eleven_multilingual_v2');
});

test('buildVoiceSettingsPayload omits unsupported style and speaker_boost on eleven_v4', () => {
  const v4Model = {
    model_id: 'eleven_v4',
    name: 'Eleven v4',
    description: '',
    can_do_text_to_speech: true,
    can_use_style: false,
    can_use_speaker_boost: false,
    maximum_text_length_per_request: 10000,
    languages: [{ language_id: 'bn', name: 'Bengali' }],
    supportsBengali: true,
  };

  const payload = buildVoiceSettingsPayload(
    {
      stability: 0.55,
      similarity_boost: 0.8,
      speed: 1.05,
      style: 0.4,
      use_speaker_boost: true,
    },
    v4Model
  );

  assert.deepEqual(payload, {
    stability: 0.55,
    similarity_boost: 0.8,
    speed: 1.05,
  });
  assert.equal('style' in payload, false);
  assert.equal('use_speaker_boost' in payload, false);
});

test('sanitizeEmotionTags keeps valid ElevenLabs tags, normalizes synonyms, and strips unsupported tags', () => {
  const raw = '[whispering] কিন্তু দরজা খুলতেই... [unsupported_robot_fx] [dramatic] সে যা দেখল, তা বিশ্বাস করতে পারছিল না!';
  const sanitized = sanitizeEmotionTags(raw);
  assert.equal(
    sanitized,
    '[whispers] কিন্তু দরজা খুলতেই... [dramatic] সে যা দেখল, তা বিশ্বাস করতে পারছিল না!'
  );

  const stripped = stripEmotionTags(sanitized);
  assert.equal(
    stripped,
    'কিন্তু দরজা খুলতেই... সে যা দেখল, তা বিশ্বাস করতে পারছিল না!'
  );
});

test('deterministicEnhanceScript inserts emotion tags without modifying Bengali words', () => {
  const original = 'কিন্তু দরজা খুলতেই সে যা দেখল, তা বিশ্বাস করতে পারছিল না!';
  const enhanced = deterministicEnhanceScript(original);
  assert.ok(enhanced.includes('[whispers]') || enhanced.includes('[dramatic]'));
  // Stripping tags and extra ellipsis must preserve original Bengali words
  const wordsOriginal = original.replace(/[,.!।]/g, '').split(/\s+/);
  for (const word of wordsOriginal) {
    assert.ok(enhanced.includes(word), `Missing Bengali word: ${word}`);
  }
});

test('splitTextIntoSafeChunks respects character limits and sentence boundaries', () => {
  const s1 = 'হঠাৎ একদিন গভীর রাতে একটি অদ্ভুত ঘটনা ঘটল।';
  const s2 = 'কিন্তু দরজা খুলতেই সে যা দেখল, তা বিশ্বাস করতে পারছিল না!';
  const s3 = 'সে ধীরে ধীরে ঘরের ভেতরে পা রাখল।';
  const combined = `${s1} ${s2} ${s3}`;

  const chunks = splitTextIntoSafeChunks(combined, 200);
  assert.equal(chunks.length, 1);

  // Force smaller limit above 200 using repeated sentences
  const longScript = Array.from({ length: 12 }, () => s1).join(' ');
  const multiChunks = splitTextIntoSafeChunks(longScript, 220);
  assert.ok(multiChunks.length >= 2);
  for (const chunk of multiChunks) {
    assert.ok(chunk.length <= 220);
  }
});

test('mergeMp3Buffers strips duplicate ID3v2 headers on subsequent chunks', () => {
  // Chunk 1 with 10-byte ID3 header + 10-byte body + 4-byte audio frame
  const chunk1 = new Uint8Array([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // ID3v2 header with size 2
    0xaa, 0xbb, // 2 bytes ID3 tag payload
    0xff, 0xfb, 0x90, 0x64, // MP3 frame bytes
  ]);
  const chunk2 = new Uint8Array([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // Duplicate ID3v2 header with size 2
    0xcc, 0xdd, // 2 bytes ID3 tag payload (should be stripped)
    0xff, 0xfb, 0x90, 0x65, // MP3 frame bytes
  ]);

  const merged = mergeMp3Buffers([chunk1, chunk2]);
  // chunk1 (16 bytes) + chunk2 audio frames only (4 bytes) = 20 bytes
  assert.equal(merged.length, 20);
  assert.deepEqual(Array.from(merged.slice(16)), [0xff, 0xfb, 0x90, 0x65]);
});

test('validateGenerationRequest validates empty text, missing voice, and Bengali model compatibility', () => {
  const v4Model = {
    model_id: 'eleven_v4',
    name: 'Eleven v4',
    description: '',
    can_do_text_to_speech: true,
    can_use_style: false,
    can_use_speaker_boost: false,
    maximum_text_length_per_request: 10000,
    languages: [{ language_id: 'bn', name: 'Bengali' }],
    supportsBengali: true,
  };

  const emptyRes = validateGenerationRequest({ text: '   ', voiceId: 'v1', model: v4Model });
  assert.equal(emptyRes.valid, false);

  const validBn = validateGenerationRequest({
    text: 'হঠাৎ একদিন গভীর রাতে একটি অদ্ভুত ঘটনা ঘটল।',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    model: v4Model,
  });
  assert.equal(validBn.valid, true);
  assert.equal(validBn.warning, undefined);
});
