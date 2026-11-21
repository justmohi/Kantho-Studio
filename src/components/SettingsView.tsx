import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Server,
  Sliders,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type {
  ApiConfigStatus,
  ElevenLabsModel,
  EmotionMode,
  OutputAudioFormat,
  VoiceSettingsConfig,
} from '../types/studio';

interface SettingsViewProps {
  configStatus: ApiConfigStatus | null;
  models: ElevenLabsModel[];
  selectedModel: ElevenLabsModel | null;
  onSelectModel: (model: ElevenLabsModel) => void;
  emotionMode: EmotionMode;
  onChangeEmotionMode: (mode: EmotionMode) => void;
  outputFormat: OutputAudioFormat;
  onChangeOutputFormat: (format: OutputAudioFormat) => void;
  voiceSettings: VoiceSettingsConfig;
  onChangeVoiceSettings: (settings: VoiceSettingsConfig) => void;
  onRefreshConfig: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  configStatus,
  models,
  selectedModel,
  onSelectModel,
  emotionMode,
  onChangeEmotionMode,
  outputFormat,
  onChangeOutputFormat,
  voiceSettings,
  onChangeVoiceSettings,
  onRefreshConfig,
}) => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-slate-800/80 pb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Studio Settings & Backend Security
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Verify server-side ElevenLabs and Gemini API connectivity and configure default synthesis parameters.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshConfig}
          className="px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#0D111A] hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-Verify Connection</span>
        </button>
      </div>

      {/* Server-Side Security & Integration Verification */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Server-Side API Key Security & Endpoints</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#090B10] border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="text-xs text-slate-400">ElevenLabs API Key</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {configStatus?.elevenlabsConfigured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Configured on Server</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400">Missing in Environment</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono-tabular">
              Env: ELEVENLABS_API_KEY (Hidden from client)
            </p>
          </div>

          <div className="bg-[#090B10] border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="text-xs text-slate-400">Gemini Auto-Enhance Engine</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">
                {configStatus?.geminiConfigured
                  ? 'Gemini API Active'
                  : 'Bengali Syntax Analyzer Ready'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono-tabular">
              Env: GEMINI_API_KEY (Server-side only)
            </p>
          </div>

          <div className="bg-[#090B10] border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="text-xs text-slate-400">Official ElevenLabs Endpoint</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 font-mono-tabular">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>{configStatus?.apiBaseUrl || 'https://api.elevenlabs.io'}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono-tabular">
              /v2/voices · /v1/models · /v1/text-to-speech
            </p>
          </div>
        </div>
      </div>

      {/* Default Studio Preferences */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Default Studio Configuration</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="settings-default-model" className="text-xs font-medium text-slate-300 block">
              Preferred Synthesis Model
            </label>
            <select
              id="settings-default-model"
              value={selectedModel?.model_id || ''}
              onChange={(e) => {
                const found = models.find((m) => m.model_id === e.target.value);
                if (found) onSelectModel(found);
              }}
              className="w-full px-3 py-2 text-xs text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg"
            >
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.name} ({m.model_id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-emotion-mode" className="text-xs font-medium text-slate-300 block">
              Default Emotion Tagging Mode
            </label>
            <select
              id="settings-emotion-mode"
              value={emotionMode}
              onChange={(e) => onChangeEmotionMode(e.target.value as EmotionMode)}
              className="w-full px-3 py-2 text-xs text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg"
            >
              <option value="auto">Auto Enhance (AI inserts emotion tags)</option>
              <option value="manual">Manual (Insert & edit tags manually)</option>
              <option value="natural">Natural (No additional emotion tags)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-output-format" className="text-xs font-medium text-slate-300 block">
              Output MP3 Stream Format
            </label>
            <select
              id="settings-output-format"
              value={outputFormat}
              onChange={(e) => onChangeOutputFormat(e.target.value as OutputAudioFormat)}
              className="w-full px-3 py-2 text-xs font-mono-tabular text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg"
            >
              <option value="mp3_44100_128">mp3_44100_128 (44.1kHz, 128kbps)</option>
              <option value="mp3_44100_192">mp3_44100_192 (44.1kHz, 192kbps)</option>
              <option value="mp3_22050_32">mp3_22050_32 (22.05kHz, 32kbps)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-300">
              Current Voice Tuning
            </div>
            <div className="px-3 py-2 text-xs font-mono-tabular text-slate-400 bg-[#090B10] border border-slate-800 rounded-lg flex items-center justify-between">
              <span>
                Stability {Math.round(voiceSettings.stability * 100)}% · Similarity{' '}
                {Math.round(voiceSettings.similarity_boost * 100)}% · Speed {voiceSettings.speed}x
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeVoiceSettings({
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: 1.0,
                  })
                }
                className="text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
