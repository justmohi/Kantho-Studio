import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  FileAudio,
  Sparkles,
} from 'lucide-react';
import type { GenerationHistoryItem } from '../types/studio';

interface AudioPlayerDockProps {
  activeGeneration: GenerationHistoryItem | null;
  onRegenerate?: (item: GenerationHistoryItem) => void;
  isGenerating?: boolean;
}

export const AudioPlayerDock: React.FC<AudioPlayerDockProps> = ({
  activeGeneration,
  onRegenerate,
  isGenerating = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!activeGeneration || !audioRef.current) return;
    const audio = audioRef.current;
    audio.pause();
    audio.src = activeGeneration.audioUrl;
    audio.playbackRate = playbackRate;
    audio.load();
    setCurrentTime(0);
    setDuration(0);

    // Auto-play newly generated audio when ready
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [activeGeneration?.id]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !activeGeneration) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(e.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.85, 1, 1.15, 1.25];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  if (!activeGeneration) return null;

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      data-testid="audio-player-dock"
      className="sticky bottom-0 z-30 border-t border-slate-800/90 bg-[#0D111A]/95 backdrop-blur-md transition-all"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Expandable Generation Details Drawer */}
      {showDetails && (
        <div className="border-b border-slate-800/80 bg-[#090B10] px-6 py-4">
          <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Generation Telemetry & Voice Identity
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs border border-slate-800/80 rounded-lg p-3 bg-[#0D111A]">
                <div>
                  <span className="text-slate-500 block">Voice Name</span>
                  <span className="text-slate-200 font-medium">{activeGeneration.voiceName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Original Voice ID</span>
                  <span className="text-amber-400 font-mono-tabular">{activeGeneration.voiceId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">ElevenLabs Model</span>
                  <span className="text-slate-200">
                    {activeGeneration.modelName} ({activeGeneration.modelId})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Detected Script</span>
                  <span className="text-slate-200">{activeGeneration.languageDetected}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Voice Parameters</span>
                  <span className="text-slate-300 font-mono-tabular">
                    Stab {Math.round(activeGeneration.settings.stability * 100)}% · Sim{' '}
                    {Math.round(activeGeneration.settings.similarity_boost * 100)}% · Spd{' '}
                    {activeGeneration.settings.speed}x
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Stream</span>
                  <span className="text-slate-300 font-mono-tabular">
                    {activeGeneration.outputFormat} · {formatBytes(activeGeneration.audioSizeBytes)} ·{' '}
                    {activeGeneration.chunkCount} chunk{activeGeneration.chunkCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-800/80 rounded-lg p-3 bg-[#0D111A]">
                <div className="text-xs text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Original Input Script</span>
                  <span className="font-mono-tabular text-slate-500">
                    {activeGeneration.originalText.length} chars
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-bengali line-clamp-4 leading-relaxed">
                  {activeGeneration.originalText}
                </p>
              </div>

              <div className="border border-slate-800/80 rounded-lg p-3 bg-[#0D111A]">
                <div className="text-xs text-amber-400/90 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Synthesized Script ({activeGeneration.emotionMode} mode)
                  </span>
                  <span className="font-mono-tabular text-slate-500">
                    {activeGeneration.enhancedText.length} chars
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-bengali line-clamp-4 leading-relaxed">
                  {activeGeneration.enhancedText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Player Controls Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Play/Pause + Track Meta */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause generated voice' : 'Play generated voice'}
            className="w-10 h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileAudio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-slate-100 truncate">
                {activeGeneration.voiceName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-slate-400 truncate">
                {activeGeneration.modelName}
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden md:inline text-slate-400 truncate">
                {activeGeneration.languageDetected}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-bengali truncate mt-0.5 max-w-md">
              {activeGeneration.enhancedText}
            </p>
          </div>
        </div>

        {/* Center: Scrubber & Time */}
        <div className="flex items-center gap-3 w-full sm:max-w-md flex-1">
          <span className="text-xs font-mono-tabular text-slate-400 w-11 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              aria-label="Seek audio timeline"
              min={0}
              max={duration || 100}
              step={0.05}
              value={currentTime}
              onChange={handleSeek}
              className="studio-slider w-full z-10"
            />
            <div
              className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-amber-500/40 rounded-l-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono-tabular text-slate-400 w-11 shrink-0">
            {formatTime(duration || activeGeneration.characterCount / 14)}
          </span>
        </div>

        {/* Right: Actions (Speed, Mute, Details, Regenerate, Download MP3) */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={cyclePlaybackRate}
            aria-label="Change playback speed"
            className="px-2.5 py-1.5 text-xs font-mono-tabular text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-md transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            aria-expanded={showDetails}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Details</span>
            {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {onRegenerate && (
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onRegenerate(activeGeneration)}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          )}

          <a
            href={`${activeGeneration.audioUrl}?download=1`}
            download={`kantho-${activeGeneration.voiceName.replace(/\s+/g, '-').toLowerCase()}-${activeGeneration.id}.mp3`}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP3</span>
          </a>
        </div>
      </div>
    </div>
  );
};
