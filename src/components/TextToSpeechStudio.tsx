import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Trash2,
  ClipboardPaste,
  Volume2,
  Pause,
  Wand2,
  Sliders,
  Mic2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  BookOpen,
  Layers,
} from 'lucide-react';
import type {
  ElevenLabsModel,
  ElevenLabsVoice,
  EmotionMode,
  GenerationHistoryItem,
  OutputAudioFormat,
  VoiceSettingsConfig,
} from '../types/studio';
import {
  SUPPORTED_EMOTION_TAGS,
  detectScriptLanguage,
  getSupportedSettingsForModel,
  splitTextIntoSafeChunks,
  validateGenerationRequest,
  deterministicEnhanceScript,
  sanitizeEmotionTags,
} from '../utils/ttsEngine';

interface TextToSpeechStudioProps {
  text: string;
  onChangeText: (text: string) => void;
  enhancedText: string;
  onChangeEnhancedText: (text: string) => void;
  emotionMode: EmotionMode;
  onChangeEmotionMode: (mode: EmotionMode) => void;
  voices: ElevenLabsVoice[];
  selectedVoice: ElevenLabsVoice | null;
  onSelectVoice: (voice: ElevenLabsVoice) => void;
  models: ElevenLabsModel[];
  selectedModel: ElevenLabsModel | null;
  onSelectModel: (model: ElevenLabsModel) => void;
  voiceSettings: VoiceSettingsConfig;
  onChangeVoiceSettings: (settings: VoiceSettingsConfig) => void;
  outputFormat: OutputAudioFormat;
  onChangeOutputFormat: (format: OutputAudioFormat) => void;
  onGenerateComplete: (item: GenerationHistoryItem) => void;
  onOpenVoiceLibrary: () => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export const BENGALI_PRESETS = [
  {
    id: 'midnight_mystery',
    title: 'গভীর রাতের রহস্য (Midnight Mystery)',
    text: 'হঠাৎ একদিন গভীর রাতে একটি অদ্ভুত ঘটনা ঘটল। কিন্তু দরজা খুলতেই সে যা দেখল, তা বিশ্বাস করতে পারছিল না!',
  },
  {
    id: 'bangladeshi_narration',
    title: 'বাংলার প্রকৃতি ও নদী (Bangladeshi Documentary)',
    text: 'পদ্মা আর মেঘনার পাড়ে ভোরের আলো যখন ধীরে ধীরে ফুটে ওঠে, তখন কুয়াশাভেজা বাতাসে এক অদ্ভুত প্রশান্তি ছড়িয়ে পড়ে। দূরে মাঝির ভাটিয়ালি গানের সুর যেন পুরো গ্রামকে জাগিয়ে তোলে।',
  },
  {
    id: 'dramatic_thriller',
    title: 'নাটকীয় সংলাপ (Dramatic Storytelling)',
    text: 'বৃষ্টিভেজা সন্ধ্যায় পুরনো চিঠিটা হাতে নিয়ে সে অনেকক্ষণ চুপ করে বসে রইল। হঠাৎ ঘরের কোণে একটা ছায়া নড়ে উঠল! কে ওখানে? কেউ কি আমার কথা শুনতে পাচ্ছে?',
  },
  {
    id: 'english_narration',
    title: 'English Studio Narration',
    text: 'In the quiet hours before dawn, the studio lights flickered on. Every voice carries a distinct memory, waiting to be heard across languages and borders.',
  },
];

export const TextToSpeechStudio: React.FC<TextToSpeechStudioProps> = ({
  text,
  onChangeText,
  enhancedText,
  onChangeEnhancedText,
  emotionMode,
  onChangeEmotionMode,
  voices,
  selectedVoice,
  onSelectVoice,
  models,
  selectedModel,
  onSelectModel,
  voiceSettings,
  onChangeVoiceSettings,
  outputFormat,
  onChangeOutputFormat,
  onGenerateComplete,
  onOpenVoiceLibrary,
  isGenerating,
  setIsGenerating,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceProvider, setEnhanceProvider] = useState<'gemini' | 'deterministic' | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const languageAnalysis = useMemo(() => detectScriptLanguage(text), [text]);
  const supportedSettings = useMemo(
    () => getSupportedSettingsForModel(selectedModel),
    [selectedModel]
  );

  const chunksPreview = useMemo(() => {
    const activeScript =
      emotionMode === 'auto' && enhancedText.trim() ? enhancedText : text;
    const maxChunk = Math.min(supportedSettings.maxCharacters || 5000, 2800);
    return splitTextIntoSafeChunks(activeScript, maxChunk);
  }, [text, enhancedText, emotionMode, supportedSettings.maxCharacters]);

  const filteredDropdownVoices = useMemo(() => {
    const q = voiceSearchQuery.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.voice_id.toLowerCase().includes(q) ||
        (v.labels?.accent || '').toLowerCase().includes(q) ||
        (v.labels?.gender || '').toLowerCase().includes(q)
    );
  }, [voices, voiceSearchQuery]);

  const handlePasteText = async () => {
    setErrorMessage(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          onChangeText(text ? `${text}\n${clip}` : clip);
          return;
        }
      }
    } catch {
      // Clipboard read blocked in iframe; focus textarea and insert sample if empty
    }
    if (!text.trim()) {
      onChangeText(BENGALI_PRESETS[0].text);
    } else {
      textareaRef.current?.focus();
    }
  };

  const handleClearText = () => {
    onChangeText('');
    onChangeEnhancedText('');
    setEnhanceProvider(null);
    setErrorMessage(null);
  };

  const handleInsertTag = (tag: string) => {
    if (emotionMode === 'auto' && enhancedText.trim()) {
      onChangeEnhancedText(`${enhancedText.trim()} ${tag} `);
      return;
    }

    const el = textareaRef.current;
    if (!el) {
      onChangeText(`${text} ${tag} `.trimStart());
      return;
    }

    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const spacerBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
    const spacerAfter = after.length > 0 && !after.startsWith(' ') ? ' ' : ' ';
    const updated = `${before}${spacerBefore}${tag}${spacerAfter}${after}`;
    onChangeText(updated);

    requestAnimationFrame(() => {
      el.focus();
      const nextPos = start + spacerBefore.length + tag.length + spacerAfter.length;
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleRunAutoEnhance = async () => {
    if (!text.trim()) {
      setErrorMessage('Please enter Bengali or English script text before running Auto Enhance.');
      return;
    }
    setErrorMessage(null);
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/tts/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          modelId: selectedModel?.model_id || 'eleven_v4',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto-enhance script.');
      }
      onChangeEnhancedText(data.enhancedText || deterministicEnhanceScript(text));
      setEnhanceProvider(data.provider || 'gemini');
    } catch {
      const localEnhanced = sanitizeEmotionTags(
        deterministicEnhanceScript(text),
        selectedModel
      );
      onChangeEnhancedText(localEnhanced);
      setEnhanceProvider('deterministic');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleToggleVoicePreview = () => {
    if (!selectedVoice?.preview_url) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
      previewAudioRef.current.onerror = () => setIsPlayingPreview(false);
    }
    const audio = previewAudioRef.current;
    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.pause();
      audio.src = selectedVoice.preview_url;
      audio
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch(() => setIsPlayingPreview(false));
    }
  };

  const handleGenerateVoice = async () => {
    setErrorMessage(null);
    const validation = validateGenerationRequest({
      text,
      voiceId: selectedVoice?.voice_id || '',
      model: selectedModel,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Validation failed.');
      return;
    }

    setIsGenerating(true);
    try {
      let scriptToUse = enhancedText;

      if (emotionMode === 'auto' && !scriptToUse.trim()) {
        setGenerationStatus('Analyzing Bengali/English script & applying AI Emotion Tags...');
        try {
          const enhanceRes = await fetch('/api/tts/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              modelId: selectedModel?.model_id || 'eleven_v4',
            }),
          });
          if (enhanceRes.ok) {
            const enhanceData = await enhanceRes.json();
            if (enhanceData.enhancedText) {
              scriptToUse = enhanceData.enhancedText;
              onChangeEnhancedText(scriptToUse);
              setEnhanceProvider(enhanceData.provider || 'gemini');
            }
          }
        } catch {
          scriptToUse = sanitizeEmotionTags(deterministicEnhanceScript(text), selectedModel);
          onChangeEnhancedText(scriptToUse);
        }
      }

      setGenerationStatus(
        chunksPreview.length > 1
          ? `Synthesizing ${chunksPreview.length} sequential audio chunks via ElevenLabs (${selectedModel?.name})...`
          : `Generating natural speech with ${selectedVoice?.name} on ${selectedModel?.name}...`
      );

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: text,
          enhancedText: emotionMode === 'auto' ? scriptToUse : text,
          emotionMode,
          voiceId: selectedVoice!.voice_id,
          voiceName: selectedVoice!.name,
          voiceCategory: selectedVoice!.category,
          voiceAccent: selectedVoice!.labels?.accent,
          modelId: selectedModel!.model_id,
          outputFormat,
          voiceSettings,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ElevenLabs audio generation failed.');
      }

      if (data.generation) {
        if (emotionMode === 'auto' && data.generation.enhancedText) {
          onChangeEnhancedText(data.generation.enhancedText);
        }
        onGenerateComplete(data.generation);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during audio generation.');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const resetVoiceSettings = () => {
    onChangeVoiceSettings({
      stability: 0.5,
      similarity_boost: 0.75,
      speed: 1.0,
      style: 0,
      use_speaker_boost: true,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT / CENTER COLUMN (7 cols): Script Editor & Emotion Tagging Studio */}
      <div className="lg:col-span-7 space-y-5">
        {/* Preset Story Starters Bar */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              Quick Script Presets (Bengali & Multilingual)
            </span>
            <span className="text-xs text-slate-500">Click to load into studio editor</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {BENGALI_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChangeText(preset.text);
                  onChangeEnhancedText('');
                  setErrorMessage(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#090B10] hover:bg-slate-800/90 border border-slate-800 rounded-lg transition-colors font-bengali whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Main Unicode Script Editor Card */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl overflow-hidden">
          {/* Editor Top Toolbar */}
          <div className="px-4 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#101520]">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-200">Script Input</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span
                data-testid="detected-language-label"
                className={`font-medium ${
                  languageAnalysis.hasBengaliUnicode ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {languageAnalysis.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteText}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#090B10] border border-slate-800 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-400" />
                <span>Paste Text</span>
              </button>
              <button
                type="button"
                onClick={handleClearText}
                disabled={!text && !enhancedText}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-red-300 bg-[#090B10] border border-slate-800 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Text</span>
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="p-4">
            <label htmlFor="studio-script-textarea" className="sr-only">
              Bengali or English Script Text
            </label>
            <textarea
              id="studio-script-textarea"
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                onChangeText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              rows={7}
              placeholder="এখানে বাংলা বা ইংরেজি টেক্সট লিখুন... (e.g., হঠাৎ একদিন গভীর রাতে একটি অদ্ভুত ঘটনা ঘটল।)"
              className="w-full bg-transparent text-slate-100 placeholder:text-slate-600 font-bengali text-base leading-relaxed focus:outline-none resize-y min-h-[170px]"
            />
          </div>

          {/* Editor Bottom Telemetry Bar */}
          <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#090B10]/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono-tabular">
            <div className="flex items-center gap-2">
              <span data-testid="char-counter">
                {text.length} / {supportedSettings.maxCharacters} chars
              </span>
              <span aria-hidden="true">·</span>
              <span>{languageAnalysis.wordCount} words</span>
              <span aria-hidden="true">·</span>
              <span>~{languageAnalysis.estimatedDurationSeconds}s audio</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {chunksPreview.length} synthesis chunk{chunksPreview.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* Emotion & Audio Tagging Studio Card */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Emotion & Vocal Delivery Tags</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enhance Bengali or English storytelling with ElevenLabs expressive cues without altering your words.
              </p>
            </div>

            {/* 3-Mode Segmented Control: Auto Enhance | Manual | Natural */}
            <div
              role="group"
              aria-label="Emotion Tagging Mode"
              className="flex items-center gap-1 p-1 bg-[#090B10] border border-slate-800 rounded-lg self-start sm:self-auto"
            >
              {(
                [
                  { id: 'auto', label: 'Auto Enhance' },
                  { id: 'manual', label: 'Manual' },
                  { id: 'natural', label: 'Natural' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeEmotionMode(m.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    emotionMode === m.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-Specific Controls */}
          {emotionMode === 'auto' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#090B10] border border-slate-800/80 rounded-lg p-3">
                <div className="text-xs text-slate-300">
                  <span className="font-medium text-amber-400">AI Auto Enhance Active:</span> Gemini analyzes your Bengali script and inserts expressive tags like <code className="text-slate-200 font-mono-tabular">[whispers]</code> or <code className="text-slate-200 font-mono-tabular">[dramatic]</code> while preserving 100% of your original Bengali words.
                </div>
                <button
                  type="button"
                  onClick={handleRunAutoEnhance}
                  disabled={isEnhancing || !text.trim()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                  <span>
                    {isEnhancing
                      ? 'Enhancing Script...'
                      : enhancedText
                        ? 'Re-Enhance with AI'
                        : 'Preview Auto-Enhanced Script'}
                  </span>
                </button>
              </div>

              {/* Editable Enhanced Text Box (Always let users edit enhanced text before generating audio) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="enhanced-script-textarea"
                    className="font-medium text-slate-300"
                  >
                    Enhanced Script Preview (Editable before generation)
                  </label>
                  {enhanceProvider && (
                    <span className="text-slate-500 font-mono-tabular">
                      Tagged via {enhanceProvider === 'gemini' ? 'Gemini AI' : 'Bengali Syntax Analyzer'}
                    </span>
                  )}
                </div>
                <textarea
                  id="enhanced-script-textarea"
                  value={enhancedText}
                  onChange={(e) => onChangeEnhancedText(e.target.value)}
                  rows={4}
                  placeholder="Click 'Preview Auto-Enhanced Script' to inspect & edit emotion tags before generating, or click 'Generate Voice' to auto-enhance automatically."
                  className="w-full p-3 text-sm text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg font-bengali leading-relaxed focus:outline-none focus:border-amber-500/70 placeholder:text-slate-600"
                />
              </div>

              {/* Quick Tag Palette for tweaking Auto-Enhanced Script */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-slate-500 mr-1">Insert tag:</span>
                {SUPPORTED_EMOTION_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    title={`${item.description} (${item.bengaliLabel})`}
                    className="px-2 py-1 text-xs font-mono-tabular text-slate-300 hover:text-amber-300 bg-[#090B10] hover:bg-slate-800 border border-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {item.tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {emotionMode === 'manual' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-400">
                Click any supported ElevenLabs emotion tag below to insert it directly at your cursor position in the script editor:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_EMOTION_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="px-2.5 py-1.5 text-xs bg-[#090B10] hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span className="font-mono-tabular text-amber-400 font-medium">{item.tag}</span>
                    <span className="text-slate-400 font-bengali">{item.bengaliLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {emotionMode === 'natural' && (
            <div className="bg-[#090B10] border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300">
              <span className="font-medium text-slate-100">Natural Mode Active:</span> Audio will be generated directly from your clean Bengali or English prose without any additional bracketed emotion tags.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN (5 cols): Voice Selector, Model Selector, Voice Settings & Generate Button */}
      <div className="lg:col-span-5 space-y-5">
        {/* 1. Selected Voice Card */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5 text-amber-400" />
              Selected ElevenLabs Voice
            </span>
            <button
              type="button"
              onClick={onOpenVoiceLibrary}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Browse Full Voice Library →
            </button>
          </div>

          {selectedVoice ? (
            <div className="bg-[#090B10] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    data-testid="selected-voice-name"
                    className="text-sm font-semibold text-slate-100 truncate"
                  >
                    {selectedVoice.name}
                  </div>
                  <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                    Voice ID: {selectedVoice.voice_id}
                  </div>
                </div>

                {selectedVoice.preview_url && (
                  <button
                    type="button"
                    onClick={handleToggleVoicePreview}
                    aria-label={
                      isPlayingPreview
                        ? `Stop preview for ${selectedVoice.name}`
                        : `Preview ${selectedVoice.name}`
                    }
                    className="px-2.5 py-1.5 text-xs font-medium bg-[#111622] hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {isPlayingPreview ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400 capitalize">
                <span>{selectedVoice.category}</span>
                {selectedVoice.labels?.gender && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{selectedVoice.labels.gender}</span>
                  </>
                )}
                {selectedVoice.labels?.accent && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{selectedVoice.labels.accent} accent</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">Preserves Identity in Bengali</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#090B10] border border-slate-800 rounded-lg p-3.5 text-xs text-slate-400">
              Loading account voices from ElevenLabs...
            </div>
          )}

          {/* Quick Voice Switcher Search & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVoiceDropdown((prev) => !prev)}
              aria-expanded={showVoiceDropdown}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#090B10] hover:bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Switch Voice ({voices.length} available on account)</span>
              <span className="text-slate-400">{showVoiceDropdown ? '▲' : '▼'}</span>
            </button>

            {showVoiceDropdown && (
              <div className="mt-2 bg-[#090B10] border border-slate-800 rounded-lg p-2 shadow-xl space-y-2 max-h-64 overflow-y-auto z-20">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={voiceSearchQuery}
                    onChange={(e) => setVoiceSearchQuery(e.target.value)}
                    placeholder="Filter voices by name or accent..."
                    aria-label="Filter voices in quick switcher"
                    className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-100 bg-[#0D111A] border border-slate-800 rounded focus:outline-none focus:border-amber-500/70"
                  />
                </div>
                <div className="space-y-1">
                  {filteredDropdownVoices.map((v) => (
                    <button
                      key={v.voice_id}
                      type="button"
                      onClick={() => {
                        onSelectVoice(v);
                        setShowVoiceDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        v.voice_id === selectedVoice?.voice_id
                          ? 'bg-amber-500/15 text-amber-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="truncate">{v.name}</span>
                      <span className="text-slate-500 capitalize shrink-0">
                        {v.labels?.gender || v.category} · {v.labels?.accent || 'standard'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Model Selection Card */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="studio-model-select" className="text-xs font-semibold text-slate-300">
              ElevenLabs Synthesis Model
            </label>
            {selectedModel?.supportsBengali && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Bengali Compatible
              </span>
            )}
          </div>

          <select
            id="studio-model-select"
            value={selectedModel?.model_id || ''}
            onChange={(e) => {
              const found = models.find((m) => m.model_id === e.target.value);
              if (found) onSelectModel(found);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
          >
            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.name} ({m.model_id}){m.isPreferred ? ' — Preferred for Bengali' : ''}
              </option>
            ))}
          </select>

          {selectedModel && (
            <div className="text-xs text-slate-400 space-y-1 bg-[#090B10] border border-slate-800/80 rounded-lg p-3">
              <p className="text-slate-300">{selectedModel.description}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500 font-mono-tabular pt-1">
                <span>Max: {selectedModel.maximum_text_length_per_request} chars/req</span>
                <span aria-hidden="true">·</span>
                <span>{selectedModel.languages.length || 29}+ languages</span>
                {selectedModel.languages.some((l) => l.language_id === 'bn') && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">Native Bengali (bn)</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Model-Aware Voice Settings Card */}
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Voice Settings ({selectedModel?.name || 'Eleven v4'})
            </span>
            <button
              type="button"
              onClick={resetVoiceSettings}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>

          {/* Stability Slider */}
          {supportedSettings.stability && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-stability" className="text-slate-300 font-medium">
                  Stability
                </label>
                <span className="font-mono-tabular text-amber-400">
                  {Math.round(voiceSettings.stability * 100)}%
                </span>
              </div>
              <input
                id="slider-stability"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceSettings.stability}
                onChange={(e) =>
                  onChangeVoiceSettings({
                    ...voiceSettings,
                    stability: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>More Expressive / Variable</span>
                <span>More Consistent / Stable</span>
              </div>
            </div>
          )}

          {/* Similarity Boost Slider */}
          {supportedSettings.similarity_boost && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-similarity" className="text-slate-300 font-medium">
                  Similarity Boost
                </label>
                <span className="font-mono-tabular text-amber-400">
                  {Math.round(voiceSettings.similarity_boost * 100)}%
                </span>
              </div>
              <input
                id="slider-similarity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceSettings.similarity_boost}
                onChange={(e) =>
                  onChangeVoiceSettings({
                    ...voiceSettings,
                    similarity_boost: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Low</span>
                <span>High Original Voice Fidelity</span>
              </div>
            </div>
          )}

          {/* Speed Slider (When supported by model) */}
          {supportedSettings.speed && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-speed" className="text-slate-300 font-medium">
                  Speed
                </label>
                <span className="font-mono-tabular text-amber-400">
                  {voiceSettings.speed.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-speed"
                type="range"
                min={0.7}
                max={1.2}
                step={0.05}
                value={voiceSettings.speed}
                onChange={(e) =>
                  onChangeVoiceSettings({
                    ...voiceSettings,
                    speed: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>0.70x (Slower Narration)</span>
                <span>1.00x</span>
                <span>1.20x (Faster)</span>
              </div>
            </div>
          )}

          {/* Style Exaggeration (ONLY displayed when selectedModel.can_use_style is true) */}
          {supportedSettings.style && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-style" className="text-slate-300 font-medium">
                  Style Exaggeration
                </label>
                <span className="font-mono-tabular text-amber-400">
                  {Math.round((voiceSettings.style ?? 0) * 100)}%
                </span>
              </div>
              <input
                id="slider-style"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceSettings.style ?? 0}
                onChange={(e) =>
                  onChangeVoiceSettings({
                    ...voiceSettings,
                    style: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
            </div>
          )}

          {/* Speaker Boost (ONLY displayed when selectedModel.can_use_speaker_boost is true) */}
          {supportedSettings.use_speaker_boost && (
            <div className="flex items-center justify-between pt-1">
              <label htmlFor="toggle-speaker-boost" className="text-xs text-slate-300 font-medium">
                Speaker Boost
              </label>
              <input
                id="toggle-speaker-boost"
                type="checkbox"
                checked={voiceSettings.use_speaker_boost ?? true}
                onChange={(e) =>
                  onChangeVoiceSettings({
                    ...voiceSettings,
                    use_speaker_boost: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Output Audio Format Selector */}
          <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
            <label htmlFor="output-format-select" className="text-xs text-slate-300 font-medium block">
              Output Audio Format
            </label>
            <select
              id="output-format-select"
              value={outputFormat}
              onChange={(e) => onChangeOutputFormat(e.target.value as OutputAudioFormat)}
              className="w-full px-3 py-2 text-xs font-mono-tabular text-slate-200 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
            >
              <option value="mp3_44100_128">MP3 · 44.1 kHz · 128 kbps (Standard Studio)</option>
              <option value="mp3_44100_192">MP3 · 44.1 kHz · 192 kbps (High Bitrate)</option>
              <option value="mp3_22050_32">MP3 · 22.05 kHz · 32 kbps (Fast / Compact)</option>
            </select>
          </div>
        </div>

        {/* Error Banner with Retry */}
        {errorMessage && (
          <div
            role="alert"
            className="bg-red-950/40 border border-red-800/80 rounded-xl p-3.5 space-y-2"
          >
            <div className="flex items-start gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateVoice}
              disabled={isGenerating}
              className="px-3 py-1 text-xs font-semibold bg-red-900/70 hover:bg-red-800 text-red-100 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Generation</span>
            </button>
          </div>
        )}

        {/* Primary Action Button: Generate Voice */}
        <button
          type="button"
          data-testid="generate-voice-btn"
          disabled={isGenerating}
          onClick={handleGenerateVoice}
          className="w-full py-3.5 px-5 rounded-xl text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{generationStatus || 'Generating Voice via ElevenLabs...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Voice</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
