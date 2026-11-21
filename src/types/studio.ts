export type NavigationTab =
  | 'dashboard'
  | 'tts'
  | 'voices'
  | 'history'
  | 'settings';

export type EmotionMode = 'auto' | 'manual' | 'natural';

export type OutputAudioFormat =
  | 'mp3_44100_128'
  | 'mp3_44100_192'
  | 'mp3_22050_32';

export interface ElevenLabsLanguage {
  language_id: string;
  name: string;
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description: string;
  can_do_text_to_speech: boolean;
  can_use_style: boolean;
  can_use_speaker_boost: boolean;
  maximum_text_length_per_request: number;
  languages: ElevenLabsLanguage[];
  supportsBengali: boolean;
  isPreferred?: boolean;
}

export interface VerifiedLanguageInfo {
  language: string;
  model_id: string;
  accent?: string | null;
  locale?: string | null;
  preview_url?: string | null;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description: string | null;
  preview_url: string | null;
  labels: {
    accent?: string;
    gender?: string;
    age?: string;
    descriptive?: string;
    use_case?: string;
    language?: string;
    [key: string]: string | undefined;
  };
  verified_languages?: VerifiedLanguageInfo[];
  fine_tuning?: {
    language?: string | null;
    state?: Record<string, string>;
  };
}

export interface VoiceLibraryResponse {
  voices: ElevenLabsVoice[];
  has_more: boolean;
  total_count: number;
  next_page_token?: string | null;
}

export interface VoiceSettingsConfig {
  stability: number;
  similarity_boost: number;
  speed: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface SupportedModelSettings {
  stability: boolean;
  similarity_boost: boolean;
  speed: boolean;
  style: boolean;
  use_speaker_boost: boolean;
  maxCharacters: number;
  supportsEmotionTags: boolean;
}

export interface ScriptLanguageAnalysis {
  primaryLanguage: 'bn' | 'en' | 'mixed' | 'other';
  label: string;
  hasBengaliUnicode: boolean;
  hasEnglishLatin: boolean;
  bengaliCharCount: number;
  latinCharCount: number;
  totalChars: number;
  wordCount: number;
  bengaliPercentage: number;
  estimatedDurationSeconds: number;
}

export interface EmotionTagDefinition {
  tag: string;
  label: string;
  bengaliLabel: string;
  category: 'delivery' | 'emotion' | 'reaction';
  description: string;
}

export interface GenerationHistoryItem {
  id: string;
  originalText: string;
  enhancedText: string;
  emotionMode: EmotionMode;
  voiceName: string;
  voiceId: string;
  voiceCategory?: string;
  voiceAccent?: string;
  modelId: string;
  modelName: string;
  outputFormat: OutputAudioFormat;
  settings: VoiceSettingsConfig;
  languageDetected: string;
  chunkCount: number;
  characterCount: number;
  audioUrl: string;
  audioSizeBytes: number;
  createdAt: string;
}

export interface ApiConfigStatus {
  elevenlabsConfigured: boolean;
  geminiConfigured: boolean;
  apiBaseUrl: string;
}
