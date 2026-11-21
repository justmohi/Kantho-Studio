import React from 'react';
import {
  Mic2,
  Sparkles,
  Play,
  ArrowRight,
  Cpu,
  History,
  Download,
  Volume2,
} from 'lucide-react';
import type {
  ElevenLabsModel,
  ElevenLabsVoice,
  GenerationHistoryItem,
  NavigationTab,
} from '../types/studio';
import { BENGALI_PRESETS } from './TextToSpeechStudio';

interface DashboardViewProps {
  voices: ElevenLabsVoice[];
  models: ElevenLabsModel[];
  history: GenerationHistoryItem[];
  selectedVoice: ElevenLabsVoice | null;
  selectedModel: ElevenLabsModel | null;
  onNavigate: (tab: NavigationTab) => void;
  onSelectVoiceAndOpenStudio: (voice: ElevenLabsVoice) => void;
  onLoadPresetInStudio: (scriptText: string) => void;
  onPlayHistoryItem: (item: GenerationHistoryItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  voices,
  models,
  history,
  selectedVoice,
  selectedModel,
  onNavigate,
  onSelectVoiceAndOpenStudio,
  onLoadPresetInStudio,
  onPlayHistoryItem,
}) => {
  const bengaliModelsCount = models.filter((m) => m.supportsBengali).length;
  const featuredVoices = voices.slice(0, 6);
  const recentHistory = history.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Studio Overview Banner */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="text-xs font-mono-tabular text-amber-400">
            ElevenLabs v4 Multilingual & Bengali Voice Synthesis
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight text-balance">
            Natural Bengali & English Voice Generation with Authentic ElevenLabs Voices
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Select any English or multilingual voice from your ElevenLabs library, write in native Bengali Unicode (<span className="font-bengali text-slate-200">বাংলা ইউনিকোড</span>) or English, enhance dramatic delivery with Gemini AI emotion tags, and export studio-grade MP3 audio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('tts')}
            className="px-5 py-3 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Text to Speech Studio</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('voices')}
            className="px-4 py-3 text-xs font-semibold text-slate-200 hover:text-white bg-[#090B10] hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mic2 className="w-4 h-4 text-amber-400" />
            <span>Explore Voice Library ({voices.length})</span>
          </button>
        </div>
      </div>

      {/* 4-Column Real Account Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">Available ElevenLabs Voices</div>
          <div className="text-2xl font-bold text-slate-100 font-mono-tabular mt-1">
            {voices.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Live via <span className="font-mono-tabular">GET /v2/voices</span>
          </div>
        </div>

        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">Bengali-Capable TTS Models</div>
          <div className="text-2xl font-bold text-amber-400 font-mono-tabular mt-1">
            {bengaliModelsCount} / {models.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Default: {selectedModel?.name || 'Eleven v4'}
          </div>
        </div>

        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">Active Studio Voice</div>
          <div className="text-base font-bold text-slate-100 truncate mt-1.5">
            {selectedVoice?.name || 'Loading...'}
          </div>
          <div className="text-xs font-mono-tabular text-slate-500 mt-1 truncate">
            ID: {selectedVoice?.voice_id || '—'}
          </div>
        </div>

        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">Generated Audio Archive</div>
          <div className="text-2xl font-bold text-slate-100 font-mono-tabular mt-1">
            {history.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Saved with MP3 & Emotion Tags
          </div>
        </div>
      </div>

      {/* Two-Column Split: Bengali Script Starters & Featured Voices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 6 Cols: Instant Bengali & English Narration Templates */}
        <div className="lg:col-span-6 bg-[#0D111A] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">
                Instant Bengali & English Narration Scripts
              </h3>
              <span className="text-xs text-slate-400">One-click studio launch</span>
            </div>

            <div className="space-y-3">
              {BENGALI_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-[#090B10] border border-slate-800/80 hover:border-slate-700 rounded-lg p-3.5 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-400 font-bengali">
                      {preset.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLoadPresetInStudio(preset.text)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-amber-300 bg-[#0D111A] border border-slate-800 rounded flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Load in Studio</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 font-bengali leading-relaxed">
                    {preset.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Featured Authentic ElevenLabs Voices */}
        <div className="lg:col-span-6 bg-[#0D111A] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">
                Featured Account Voices
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('voices')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
              >
                View all {voices.length} voices →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featuredVoices.map((v) => (
                <div
                  key={v.voice_id}
                  className="bg-[#090B10] border border-slate-800/80 hover:border-slate-700 rounded-lg p-3.5 flex flex-col justify-between gap-3 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {v.name}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                      ID: {v.voice_id}
                    </div>
                    <div className="text-xs text-slate-400 capitalize mt-1.5">
                      {v.category} · {v.labels?.gender || 'versatile'} ·{' '}
                      {v.labels?.accent || 'standard'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectVoiceAndOpenStudio(v)}
                    className="w-full py-1.5 px-3 text-xs font-semibold text-slate-200 hover:text-slate-950 bg-[#0D111A] hover:bg-amber-500 border border-slate-800 hover:border-amber-500 rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Synthesize with Voice</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Model Capabilities Summary */}
          <div className="bg-[#090B10] border border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Active Engines: <strong className="text-slate-100">Eleven v4</strong>,{' '}
                <strong className="text-slate-100">Eleven v4 Turbo</strong>,{' '}
                <strong className="text-slate-100">Eleven v3</strong> &{' '}
                <strong className="text-slate-100">Multilingual v2</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Generations Section */}
      {recentHistory.length > 0 && (
        <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>Recent Studio Generations</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Open Full History ({history.length}) →
            </button>
          </div>

          <div className="divide-y divide-slate-800/70">
            {recentHistory.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-200">{item.voiceName}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono-tabular text-amber-400">{item.modelName}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-400">{item.languageDetected}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-bengali truncate max-w-2xl">
                    {item.enhancedText}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayHistoryItem(item)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Play</span>
                  </button>
                  <a
                    href={`${item.audioUrl}?download=1`}
                    download={`kantho-${item.id}.mp3`}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#090B10] border border-slate-800 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>MP3</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
