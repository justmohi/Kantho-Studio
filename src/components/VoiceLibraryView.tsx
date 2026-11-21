import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  RefreshCw,
  Play,
  Pause,
  Check,
  Copy,
  Mic2,
  Volume2,
  Filter,
  ChevronRight,
} from 'lucide-react';
import type { ElevenLabsVoice } from '../types/studio';

interface VoiceLibraryViewProps {
  voices: ElevenLabsVoice[];
  selectedVoiceId: string;
  isLoading: boolean;
  error: string | null;
  onSelectVoice: (voice: ElevenLabsVoice, navigateToStudio?: boolean) => void;
  onRefreshVoices: () => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  bn: 'Bengali (বাংলা)',
  en: 'English',
  hi: 'Hindi',
  ar: 'Arabic',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  tr: 'Turkish',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ta: 'Tamil',
  id: 'Indonesian',
  vi: 'Vietnamese',
  uk: 'Ukrainian',
};

export const VoiceLibraryView: React.FC<VoiceLibraryViewProps> = ({
  voices,
  selectedVoiceId,
  isLoading,
  error,
  onSelectVoice,
  onRefreshVoices,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [accentFilter, setAccentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(12);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Extract unique filter options from real ElevenLabs voices
  const filterOptions = useMemo(() => {
    const accents = new Set<string>();
    const categories = new Set<string>();
    const languages = new Set<string>();

    for (const v of voices) {
      if (v.labels?.accent) accents.add(v.labels.accent.toLowerCase());
      if (v.category) categories.add(v.category.toLowerCase());
      if (v.labels?.language) languages.add(v.labels.language.toLowerCase());
      if (Array.isArray(v.verified_languages)) {
        for (const vl of v.verified_languages) {
          if (vl.language) languages.add(vl.language.toLowerCase());
        }
      }
    }

    return {
      accents: Array.from(accents).sort(),
      categories: Array.from(categories).sort(),
      languages: Array.from(languages).sort(),
    };
  }, [voices]);

  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesName = voice.name.toLowerCase().includes(q);
        const matchesId = voice.voice_id.toLowerCase().includes(q);
        const matchesDesc = (voice.description || '').toLowerCase().includes(q);
        const matchesAccent = (voice.labels?.accent || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc && !matchesAccent) {
          return false;
        }
      }

      if (genderFilter !== 'all') {
        const g = (voice.labels?.gender || '').toLowerCase();
        if (g !== genderFilter) return false;
      }

      if (accentFilter !== 'all') {
        const a = (voice.labels?.accent || '').toLowerCase();
        if (a !== accentFilter) return false;
      }

      if (categoryFilter !== 'all') {
        const c = (voice.category || '').toLowerCase();
        if (c !== categoryFilter) return false;
      }

      if (languageFilter !== 'all') {
        const primaryLang = (voice.labels?.language || '').toLowerCase();
        const verifiedLangs = (voice.verified_languages || []).map((vl) =>
          (vl.language || '').toLowerCase()
        );
        if (primaryLang !== languageFilter && !verifiedLangs.includes(languageFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [voices, searchQuery, genderFilter, accentFilter, categoryFilter, languageFilter]);

  const visibleVoices = filteredVoices.slice(0, visibleCount);

  const handleTogglePreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.onended = () => setPlayingVoiceId(null);
      previewAudioRef.current.onerror = () => setPlayingVoiceId(null);
    }

    const audio = previewAudioRef.current;
    if (playingVoiceId === voice.voice_id) {
      audio.pause();
      setPlayingVoiceId(null);
    } else {
      audio.pause();
      audio.src = voice.preview_url;
      audio
        .play()
        .then(() => setPlayingVoiceId(voice.voice_id))
        .catch(() => setPlayingVoiceId(null));
    }
  };

  const handleCopyVoiceId = (voiceId: string) => {
    navigator.clipboard?.writeText(voiceId).catch(() => {});
    setCopiedId(voiceId);
    setTimeout(() => {
      setCopiedId((prev) => (prev === voiceId ? null : prev));
    }, 1800);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setAccentFilter('all');
    setCategoryFilter('all');
    setLanguageFilter('all');
    setVisibleCount(12);
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Official ElevenLabs Voice Library
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Live voices fetched directly from <span className="font-mono-tabular text-slate-300">GET /v2/voices</span> with authentic voice IDs, descriptions, and vocal previews.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono-tabular text-slate-400">
            Showing {visibleVoices.length} of {filteredVoices.length} voices ({voices.length} total)
          </span>
          <button
            type="button"
            onClick={onRefreshVoices}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#111622] hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Voice Library</span>
          </button>
        </div>
      </div>

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-[#0D111A] border border-slate-800/90 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(12);
              }}
              placeholder="Search voice name, Voice ID, or tone..."
              aria-label="Search voices by name or ID"
              className="w-full pl-9 pr-3.5 py-2 text-xs text-slate-100 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70 placeholder:text-slate-500"
            />
          </div>

          {/* Gender Segmented Filter */}
          <div className="md:col-span-3 flex items-center gap-1 p-1 bg-[#090B10] border border-slate-800 rounded-lg">
            {(['all', 'female', 'male'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGenderFilter(g);
                  setVisibleCount(12);
                }}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                  genderFilter === g
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g === 'all' ? 'All Genders' : g}
              </button>
            ))}
          </div>

          {/* Accent Select */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by accent"
              value={accentFilter}
              onChange={(e) => {
                setAccentFilter(e.target.value);
                setVisibleCount(12);
              }}
              className="w-full px-3 py-2 text-xs text-slate-200 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
            >
              <option value="all">All Accents</option>
              {filterOptions.accents.map((acc) => (
                <option key={acc} value={acc}>
                  Accent: {acc.charAt(0).toUpperCase() + acc.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Category Select */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setVisibleCount(12);
              }}
              className="w-full px-3 py-2 text-xs text-slate-200 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
            >
              <option value="all">All Categories</option>
              {filterOptions.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Language Metadata Select */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by language"
              value={languageFilter}
              onChange={(e) => {
                setLanguageFilter(e.target.value);
                setVisibleCount(12);
              }}
              className="w-full px-3 py-2 text-xs text-slate-200 bg-[#090B10] border border-slate-800 rounded-lg focus:outline-none focus:border-amber-500/70"
            >
              <option value="all">All Languages</option>
              {filterOptions.languages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(searchQuery ||
          genderFilter !== 'all' ||
          accentFilter !== 'all' ||
          categoryFilter !== 'all' ||
          languageFilter !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              Active filters applied · {filteredVoices.length} matching voice
              {filteredVoices.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/70 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="text-xs text-red-200">{error}</div>
          <button
            type="button"
            onClick={onRefreshVoices}
            className="px-3 py-1.5 text-xs font-medium bg-red-900/60 hover:bg-red-800 text-red-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Retry Loading Voices
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && voices.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl border border-slate-800/80 bg-[#0D111A] p-5 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800/70 rounded w-1/2" />
                <div className="h-12 bg-slate-800/40 rounded w-full" />
              </div>
              <div className="h-8 bg-slate-800 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredVoices.length === 0 ? (
        <div className="bg-[#0D111A] border border-slate-800/80 rounded-xl p-10 text-center space-y-3">
          <Mic2 className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-base font-semibold text-slate-200">
            No ElevenLabs voices match your current filters
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try clearing your search query or switching the language/accent filter to view all available account voices.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
          >
            Show All Voices
          </button>
        </div>
      ) : (
        <>
          {/* Voice Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleVoices.map((voice) => {
              const isSelected = voice.voice_id === selectedVoiceId;
              const isPreviewPlaying = playingVoiceId === voice.voice_id;
              const hasNativeBn =
                voice.labels?.language === 'bn' ||
                (voice.verified_languages || []).some((vl) => vl.language === 'bn');

              // Clean unboxed metadata items (Zero-Pill Discipline)
              const metaItems = [
                voice.category,
                voice.labels?.gender,
                voice.labels?.accent,
                voice.labels?.age ? voice.labels.age.replace('_', ' ') : null,
                hasNativeBn ? 'Native Bengali Verified' : 'Multilingual / Bengali Capable (v4)',
              ].filter(Boolean);

              return (
                <div
                  key={voice.voice_id}
                  data-testid={`voice-card-${voice.voice_id}`}
                  className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#121826] border-amber-500/80'
                      : 'bg-[#0D111A] border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top row: Exact Original Name + Preview Button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                          {voice.name}
                        </h3>
                        {/* Original Voice ID with Copy */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-mono-tabular text-slate-400">
                            ID: {voice.voice_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyVoiceId(voice.voice_id)}
                            aria-label={`Copy Voice ID for ${voice.name}`}
                            className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            {copiedId === voice.voice_id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {voice.preview_url && (
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(voice)}
                          aria-label={
                            isPreviewPlaying
                              ? `Stop preview for ${voice.name}`
                              : `Play preview for ${voice.name}`
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                            isPreviewPlaying
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-[#090B10] text-slate-300 hover:text-white border border-slate-800'
                          }`}
                        >
                          {isPreviewPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
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

                    {/* Clean Unboxed Metadata Line */}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400 capitalize">
                      {metaItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span className={item?.includes('Bengali') ? 'text-amber-400/90' : ''}>
                            {item}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Voice Description */}
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {voice.description ||
                        `Authentic ElevenLabs ${voice.category} voice (${
                          voice.labels?.gender || 'versatile'
                        }, ${
                          voice.labels?.accent || 'standard'
                        } accent). Compatible with Eleven v4 Bengali and multilingual synthesis.`}
                    </p>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-800/70 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectVoice(voice, false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                          : 'bg-[#090B10] text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      {isSelected ? 'Selected Voice' : 'Select'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectVoice(voice, true)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Use in Studio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination / Load More */}
          {visibleCount < filteredVoices.length && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 12)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white bg-[#0D111A] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Load More Voices ({filteredVoices.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
