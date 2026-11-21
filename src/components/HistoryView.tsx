import React, { useMemo, useState } from 'react';
import {
  Play,
  Download,
  Trash2,
  Search,
  Clock,
  ArrowUpRight,
  Sparkles,
  FileAudio,
} from 'lucide-react';
import type { GenerationHistoryItem } from '../types/studio';

interface HistoryViewProps {
  history: GenerationHistoryItem[];
  activeGenerationId: string | null;
  onPlayHistoryItem: (item: GenerationHistoryItem) => void;
  onLoadIntoStudio: (item: GenerationHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  activeGenerationId,
  onPlayHistoryItem,
  onLoadIntoStudio,
  onDeleteHistoryItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('all');

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (modelFilter !== 'all' && item.modelId !== modelFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        item.originalText.toLowerCase().includes(q) ||
        item.enhancedText.toLowerCase().includes(q) ||
        item.voiceName.toLowerCase().includes(q) ||
        item.voiceId.toLowerCase().includes(q) ||
        item.modelId.toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery, modelFilter]);

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Generation History
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Replay, inspect original vs. emotion-enhanced Bengali/English scripts, and download MP3 masters.
          </p>
        </div>

        <div className="text-xs font-mono-tabular text-slate-400">
          {filteredHistory.length} saved generation{filteredHistory.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bengali/English text, voice name, or Voice ID..."
            aria-label="Search generation history"
            className="w-full pl-9 pr-4 py-2 text-xs text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
          />
        </div>

        <select
          aria-label="Filter history by model"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full sm:w-56 px-3 py-2 text-xs text-slate-200 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
        >
          <option value="all">All Models</option>
          <option value="eleven_v4">Eleven v4 (eleven_v4)</option>
          <option value="eleven_v4_turbo">Eleven v4 Turbo (eleven_v4_turbo)</option>
          <option value="eleven_v3">Eleven v3 (eleven_v3)</option>
          <option value="eleven_multilingual_v2">Multilingual v2 (eleven_multilingual_v2)</option>
        </select>
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-[#0D111A] border border-slate-800/80 rounded-xl p-10 text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-base font-semibold text-slate-200">
            No generated voice recordings found
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Every Bengali or English audio clip you synthesize in the Text-to-Speech Studio is automatically archived here with its original script, enhanced emotion tags, and MP3 file.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => {
            const isPlayingThis = activeGenerationId === item.id;
            return (
              <div
                key={item.id}
                data-testid={`history-item-${item.id}`}
                className={`rounded-xl border p-5 transition-colors ${
                  isPlayingThis
                    ? 'bg-[#121826] border-amber-500/70'
                    : 'bg-[#0D111A] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Top Metadata Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/70">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-semibold text-slate-100">{item.voiceName}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono-tabular text-slate-400">ID: {item.voiceId}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono-tabular text-amber-400/90">
                      {item.modelName} ({item.modelId})
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-400">{item.languageDetected}</span>
                  </div>

                  <div className="text-xs font-mono-tabular text-slate-500">
                    {formatDate(item.createdAt)}
                  </div>
                </div>

                {/* Original vs Enhanced Text Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="bg-[#090B10] border border-slate-800/80 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                      <span>Original Text</span>
                      <span className="font-mono-tabular">{item.originalText.length} chars</span>
                    </div>
                    <p className="text-sm text-slate-200 font-bengali leading-relaxed">
                      {item.originalText}
                    </p>
                  </div>

                  <div className="bg-[#090B10] border border-slate-800/80 rounded-lg p-3">
                    <div className="text-xs text-amber-400/90 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Enhanced Script ({item.emotionMode} mode)
                      </span>
                      <span className="font-mono-tabular text-slate-500">
                        {item.chunkCount} chunk{item.chunkCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-100 font-bengali leading-relaxed">
                      {item.enhancedText}
                    </p>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs font-mono-tabular text-slate-500">
                    Stability {Math.round(item.settings.stability * 100)}% · Similarity{' '}
                    {Math.round(item.settings.similarity_boost * 100)}% · Speed{' '}
                    {item.settings.speed}x · {(item.audioSizeBytes / 1024).toFixed(1)} KB
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPlayHistoryItem(item)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPlayingThis ? 'Playing in Studio' : 'Replay Audio'}</span>
                    </button>

                    <a
                      href={`${item.audioUrl}?download=1`}
                      download={`kantho-${item.voiceName.replace(/\s+/g, '-').toLowerCase()}-${item.id}.mp3`}
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-[#090B10] hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download MP3</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => onLoadIntoStudio(item)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#090B10] hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Load in Editor</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteHistoryItem(item.id)}
                      aria-label={`Delete generation from ${item.voiceName}`}
                      className="p-1.5 text-slate-500 hover:text-red-400 bg-[#090B10] border border-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
