import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Mic2,
  AudioWaveform,
  History,
  Settings,
  AlertTriangle,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import type {
  ApiConfigStatus,
  ElevenLabsModel,
  ElevenLabsVoice,
  EmotionMode,
  GenerationHistoryItem,
  NavigationTab,
  OutputAudioFormat,
  VoiceSettingsConfig,
} from './types/studio';
import { TextToSpeechStudio, BENGALI_PRESETS } from './components/TextToSpeechStudio';
import { VoiceLibraryView } from './components/VoiceLibraryView';
import { HistoryView } from './components/HistoryView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { AudioPlayerDock } from './components/AudioPlayerDock';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('tts');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Server API Configuration Status
  const [configStatus, setConfigStatus] = useState<ApiConfigStatus | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  // Real ElevenLabs Voices & Models
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  const [models, setModels] = useState<ElevenLabsModel[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [selectedModel, setSelectedModel] = useState<ElevenLabsModel | null>(null);

  // Studio Editor & Settings State
  const [scriptText, setScriptText] = useState<string>(BENGALI_PRESETS[0].text);
  const [enhancedText, setEnhancedText] = useState<string>('');
  const [emotionMode, setEmotionMode] = useState<EmotionMode>('auto');
  const [outputFormat, setOutputFormat] = useState<OutputAudioFormat>('mp3_44100_128');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsConfig>({
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1.0,
    style: 0,
    use_speaker_boost: true,
  });

  // Generation & History State
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<GenerationHistoryItem | null>(null);

  const fetchConfigAndStudioData = useCallback(async (forceRefresh = false) => {
    setIsCheckingConfig(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const simulateMissing = searchParams.get('simulate_missing_key') === '1';

      const statusRes = await fetch(
        `/api/config/status${simulateMissing ? '?simulate_missing=1' : ''}`
      );
      const statusData: ApiConfigStatus = await statusRes.json();
      setConfigStatus(statusData);

      if (!statusData.elevenlabsConfigured) {
        setIsLoadingVoices(false);
        setIsCheckingConfig(false);
        return;
      }

      setIsLoadingVoices(true);
      setVoicesError(null);

      const [modelsRes, voicesRes, historyRes] = await Promise.all([
        fetch(`/api/elevenlabs/models${forceRefresh ? '?refresh=true' : ''}`),
        fetch(`/api/elevenlabs/voices?page_size=100${forceRefresh ? '&refresh=true' : ''}`),
        fetch('/api/tts/history'),
      ]);

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const loadedModels: ElevenLabsModel[] = modelsData.models || [];
        setModels(loadedModels);
        if (loadedModels.length > 0) {
          const preferred =
            loadedModels.find((m) => m.model_id === 'eleven_v4') || loadedModels[0];
          setSelectedModel((prev) => prev || preferred);
        }
      }

      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        const loadedVoices: ElevenLabsVoice[] = voicesData.voices || [];
        setVoices(loadedVoices);
        if (loadedVoices.length > 0) {
          // Select an English-named premade voice by default (e.g. Sarah or Bella) to demonstrate natural Bengali narration
          const defaultVoice =
            loadedVoices.find((v) => v.name.toLowerCase().startsWith('sarah')) ||
            loadedVoices.find((v) => v.name.toLowerCase().startsWith('bella')) ||
            loadedVoices[0];
          setSelectedVoice((prev) => prev || defaultVoice);
        }
      } else {
        const errData = await voicesRes.json().catch(() => ({}));
        setVoicesError(errData.error || 'Failed to load ElevenLabs Voice Library.');
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const items: GenerationHistoryItem[] = historyData.history || [];
        setHistory(items);
        if (items.length > 0) {
          setActiveGeneration((prev) => prev || items[0]);
        }
      }
    } catch (err: any) {
      setVoicesError(err?.message || 'Unable to connect to studio backend.');
    } finally {
      setIsLoadingVoices(false);
      setIsCheckingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigAndStudioData(false);
  }, [fetchConfigAndStudioData]);

  const handleRefreshVoices = async () => {
    setIsLoadingVoices(true);
    setVoicesError(null);
    try {
      const res = await fetch('/api/elevenlabs/voices?page_size=100&refresh=true');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh voices.');
      }
      setVoices(data.voices || []);
    } catch (err: any) {
      setVoicesError(err?.message || 'Failed to refresh Voice Library.');
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handleGenerateComplete = (newItem: GenerationHistoryItem) => {
    setHistory((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
    setActiveGeneration(newItem);
  };

  const handleRegenerateFromPlayer = async (item: GenerationHistoryItem) => {
    setScriptText(item.originalText);
    setEnhancedText(item.enhancedText);
    setEmotionMode(item.emotionMode);
    const matchingVoice = voices.find((v) => v.voice_id === item.voiceId);
    if (matchingVoice) setSelectedVoice(matchingVoice);
    const matchingModel = models.find((m) => m.model_id === item.modelId);
    if (matchingModel) setSelectedModel(matchingModel);
    setActiveTab('tts');

    setIsGenerating(true);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: item.originalText,
          enhancedText: item.enhancedText,
          emotionMode: item.emotionMode,
          voiceId: item.voiceId,
          voiceName: item.voiceName,
          voiceCategory: item.voiceCategory,
          voiceAccent: item.voiceAccent,
          modelId: item.modelId,
          outputFormat: item.outputFormat,
          voiceSettings: item.settings,
        }),
      });
      const data = await res.json();
      if (res.ok && data.generation) {
        handleGenerateComplete(data.generation);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      const res = await fetch(`/api/tts/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (activeGeneration?.id === id) {
          setActiveGeneration(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'voices', label: 'Voice Library', icon: Mic2 },
    { id: 'tts', label: 'Text to Speech', icon: AudioWaveform },
    { id: 'history', label: 'Generation History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex flex-col">
      <div className="flex-1 flex min-h-0">
        {/* LEFT SIDEBAR (Desktop 256px fixed sticky height) */}
        <aside
          aria-label="Studio Sidebar Navigation"
          className="hidden md:flex md:w-64 md:flex-col md:shrink-0 md:sticky md:top-0 md:h-screen border-r border-slate-800/90 bg-[#0B0E16]"
        >
          {/* Brand Lockup */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('tts')}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <AudioWaveform className="w-4 h-4" />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                Kantho Studio
              </span>
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'voices' && voices.length > 0 && (
                    <span
                      aria-hidden="true"
                      className={`font-mono-tabular text-[11px] ${
                        isActive ? 'text-slate-950 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {voices.length}
                    </span>
                  )}
                  {item.id === 'history' && history.length > 0 && (
                    <span
                      aria-hidden="true"
                      className={`font-mono-tabular text-[11px] ${
                        isActive ? 'text-slate-950 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {history.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Bottom Active Voice & Model Summary */}
          <div className="p-4 border-t border-slate-800/80 space-y-2 bg-[#090B10]/50">
            <div className="text-[11px] text-slate-500">Active Synthesis Engine</div>
            <div className="text-xs font-semibold text-slate-200 truncate">
              {selectedModel?.name || 'Eleven v4'} ({selectedModel?.model_id || 'eleven_v4'})
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Voice: {selectedVoice?.name || 'Loading...'}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* TOP BAR CONTRACT: [Header Title & Breadcrumb] — [Active Voice/Model Context] — [1 Primary Action] */}
          <header className="h-16 px-4 sm:px-6 border-b border-slate-800/90 bg-[#0B0E16]/95 backdrop-blur flex items-center justify-between gap-8 sticky top-0 z-30">
            {/* Zone 1: Single-line Header Title */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
                className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
              <h1 className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
                AI Voice Studio
              </h1>
            </div>

            {/* Zone 2: Active Studio Telemetry Context */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 truncate">
              <span className="text-slate-300 font-medium">
                {navItems.find((i) => i.id === activeTab)?.label}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-amber-400">
                {selectedModel?.name || 'Eleven v4'}
              </span>
              {selectedVoice && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-xs text-slate-300">{selectedVoice.name}</span>
                </>
              )}
            </div>

            {/* Zone 3: 1 Primary Action */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'tts' ? 'voices' : 'tts')}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {activeTab === 'tts' ? 'Browse Voices' : 'Open Voice Studio'}
              </button>
            </div>
          </header>

          {/* Mobile Drawer Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-b border-slate-800 bg-[#0B0E16] px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 ${
                      isActive ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Workspace Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {/* Unconfigured API Key Setup Screen */}
            {!isCheckingConfig && configStatus && !configStatus.elevenlabsConfigured ? (
              <div
                data-testid="api-key-setup-screen"
                className="max-w-2xl mx-auto my-8 bg-[#0D111A] border border-amber-500/50 rounded-2xl p-6 sm:p-8 space-y-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      ElevenLabs Server API Key Setup Required
                    </h2>
                    <p className="text-xs text-slate-400">
                      Configure <code className="font-mono-tabular text-amber-300">ELEVENLABS_API_KEY</code> on the server to enable official voice fetching and speech synthesis.
                    </p>
                  </div>
                </div>

                <div className="bg-[#090B10] border border-slate-800 rounded-xl p-4 space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    For security, this application never accepts or stores API keys in browser storage or client-side code. All calls to <code className="font-mono-tabular text-slate-200">https://api.elevenlabs.io</code> are authenticated exclusively on the backend.
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                    <li>
                      Open the <strong className="text-slate-200">Settings &gt; Secrets</strong> panel or your server environment configuration.
                    </li>
                    <li>
                      Add the environment variable <code className="font-mono-tabular text-amber-300">ELEVENLABS_API_KEY</code> with your official ElevenLabs key.
                    </li>
                    <li>
                      Click <strong className="text-slate-200">Verify Server Configuration</strong> below to load your account voices and models.
                    </li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={() => fetchConfigAndStudioData(true)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Server Configuration</span>
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    voices={voices}
                    models={models}
                    history={history}
                    selectedVoice={selectedVoice}
                    selectedModel={selectedModel}
                    onNavigate={setActiveTab}
                    onSelectVoiceAndOpenStudio={(voice) => {
                      setSelectedVoice(voice);
                      setActiveTab('tts');
                    }}
                    onLoadPresetInStudio={(presetText) => {
                      setScriptText(presetText);
                      setEnhancedText('');
                      setActiveTab('tts');
                    }}
                    onPlayHistoryItem={(item) => setActiveGeneration(item)}
                  />
                )}

                {activeTab === 'tts' && (
                  <TextToSpeechStudio
                    text={scriptText}
                    onChangeText={setScriptText}
                    enhancedText={enhancedText}
                    onChangeEnhancedText={setEnhancedText}
                    emotionMode={emotionMode}
                    onChangeEmotionMode={setEmotionMode}
                    voices={voices}
                    selectedVoice={selectedVoice}
                    onSelectVoice={setSelectedVoice}
                    models={models}
                    selectedModel={selectedModel}
                    onSelectModel={setSelectedModel}
                    voiceSettings={voiceSettings}
                    onChangeVoiceSettings={setVoiceSettings}
                    outputFormat={outputFormat}
                    onChangeOutputFormat={setOutputFormat}
                    onGenerateComplete={handleGenerateComplete}
                    onOpenVoiceLibrary={() => setActiveTab('voices')}
                    isGenerating={isGenerating}
                    setIsGenerating={setIsGenerating}
                  />
                )}

                {activeTab === 'voices' && (
                  <VoiceLibraryView
                    voices={voices}
                    selectedVoiceId={selectedVoice?.voice_id || ''}
                    isLoading={isLoadingVoices}
                    error={voicesError}
                    onSelectVoice={(voice, navigateToStudio) => {
                      setSelectedVoice(voice);
                      if (navigateToStudio) {
                        setActiveTab('tts');
                      }
                    }}
                    onRefreshVoices={handleRefreshVoices}
                  />
                )}

                {activeTab === 'history' && (
                  <HistoryView
                    history={history}
                    activeGenerationId={activeGeneration?.id || null}
                    onPlayHistoryItem={(item) => setActiveGeneration(item)}
                    onLoadIntoStudio={(item) => {
                      setScriptText(item.originalText);
                      setEnhancedText(item.enhancedText);
                      setEmotionMode(item.emotionMode);
                      const v = voices.find((voice) => voice.voice_id === item.voiceId);
                      if (v) setSelectedVoice(v);
                      const m = models.find((model) => model.model_id === item.modelId);
                      if (m) setSelectedModel(m);
                      setActiveTab('tts');
                    }}
                    onDeleteHistoryItem={handleDeleteHistoryItem}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    configStatus={configStatus}
                    models={models}
                    selectedModel={selectedModel}
                    onSelectModel={setSelectedModel}
                    emotionMode={emotionMode}
                    onChangeEmotionMode={setEmotionMode}
                    outputFormat={outputFormat}
                    onChangeOutputFormat={setOutputFormat}
                    voiceSettings={voiceSettings}
                    onChangeVoiceSettings={setVoiceSettings}
                    onRefreshConfig={() => fetchConfigAndStudioData(true)}
                  />
                )}
              </>
            )}
          </main>

          {/* Persistent Studio Audio Player Dock */}
          <AudioPlayerDock
            activeGeneration={activeGeneration}
            onRegenerate={handleRegenerateFromPlayer}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
