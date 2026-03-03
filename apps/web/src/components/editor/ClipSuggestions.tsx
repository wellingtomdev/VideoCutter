import { useState, useEffect } from 'react';
import type { TranscriptSegment, ClipSuggestion, ClipCategory, SuggestionModel } from '../../types';
import { api } from '../../services/api';

interface ClipSuggestionsProps {
  jobId: string;
  transcript: TranscriptSegment[];
  suggestions: ClipSuggestion[];
  startMs: number;
  endMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  onSetRange: (start: number, end: number) => void;
  onSuggestionsGenerated: () => void;
}

const ALL_CATEGORIES: { value: ClipCategory; label: string }[] = [
  { value: 'exortacao', label: 'Exortação' },
  { value: 'encorajamento', label: 'Encorajamento' },
  { value: 'ensino', label: 'Ensino' },
  { value: 'testemunho', label: 'Testemunho' },
  { value: 'adoracao', label: 'Adoração' },
  { value: 'reflexao', label: 'Reflexão' },
  { value: 'chamado', label: 'Chamado' },
  { value: 'humor', label: 'Humor' },
  { value: 'ilustracao', label: 'Ilustração' },
];

const CATEGORY_COLORS: Record<ClipCategory, string> = {
  exortacao: 'bg-red-500/20 text-red-400 border-red-500/30',
  encorajamento: 'bg-green-500/20 text-green-400 border-green-500/30',
  ensino: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  testemunho: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  adoracao: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reflexao: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  chamado: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  humor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  ilustracao: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const CATEGORY_LABELS: Record<ClipCategory, string> = {
  exortacao: 'Exortação',
  encorajamento: 'Encorajamento',
  ensino: 'Ensino',
  testemunho: 'Testemunho',
  adoracao: 'Adoração',
  reflexao: 'Reflexão',
  chamado: 'Chamado',
  humor: 'Humor',
  ilustracao: 'Ilustração',
};

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ClipSuggestions({
  jobId,
  transcript,
  suggestions,
  startMs,
  endMs,
  durationMs,
  onSeek,
  onSetRange,
  onSuggestionsGenerated,
}: ClipSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSelection, setUseSelection] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ClipCategory[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [selectedModel, setSelectedModel] = useState<SuggestionModel>('gpt-4o-mini');

  const PAGE_SIZE = 10;

  // Reset page when suggestions change
  useEffect(() => {
    setPage(0);
  }, [suggestions.length]);

  const hasSelection = startMs > 0 || endMs < durationMs;

  const toggleCategory = (cat: ClipCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.suggestClips({
        jobId,
        rangeStartMs: useSelection ? startMs : undefined,
        rangeEndMs: useSelection ? endMs : undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        model: selectedModel,
      });
      onSuggestionsGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const disabled = transcript.length === 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-yellow-400">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-200">Sugestões por IA</h3>
      </div>

      {/* Range toggle */}
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="range"
            checked={!useSelection}
            onChange={() => setUseSelection(false)}
            className="accent-blue-500"
          />
          <span className="text-gray-300">Transcrição completa</span>
        </label>
        <label className={`flex items-center gap-1.5 ${hasSelection ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
          <input
            type="radio"
            name="range"
            checked={useSelection}
            onChange={() => setUseSelection(true)}
            disabled={!hasSelection}
            className="accent-blue-500"
          />
          <span className="text-gray-300">
            Usar seleção ({formatMs(startMs)} → {formatMs(endMs)})
          </span>
        </label>
      </div>

      {/* Model toggle */}
      <div className="flex items-center gap-1 text-xs" data-testid="model-toggle">
        <span className="text-gray-500 mr-1">Modelo:</span>
        <button
          onClick={() => setSelectedModel('gpt-4o-mini')}
          className={`px-2.5 py-1 rounded-l-md border transition-colors ${
            selectedModel === 'gpt-4o-mini'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-800 text-gray-400 border-gray-600 hover:text-gray-300'
          }`}
        >
          Rápido
        </button>
        <button
          onClick={() => setSelectedModel('gpt-4o')}
          className={`px-2.5 py-1 rounded-r-md border border-l-0 transition-colors ${
            selectedModel === 'gpt-4o'
              ? 'bg-yellow-600/30 text-yellow-300 border-yellow-600/50'
              : 'bg-gray-800 text-gray-400 border-gray-600 hover:text-gray-300'
          }`}
        >
          Preciso
        </button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map(({ value, label }) => {
          const selected = selectedCategories.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleCategory(value)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                selected
                  ? CATEGORY_COLORS[value]
                  : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={disabled || loading}
        className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Analisando transcrição...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Gerar Sugestões
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400" data-testid="suggestions-error">{error}</p>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (() => {
        const totalPages = Math.ceil(suggestions.length / PAGE_SIZE);
        const pagedSuggestions = suggestions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const pageOffset = page * PAGE_SIZE;

        return (
          <>
            <div className="space-y-2">
              {pagedSuggestions.map((s, i) => {
                const globalIndex = pageOffset + i;
                const expanded = expandedId === globalIndex;
                const durationSec = Math.round((s.endMs - s.startMs) / 1000);
                return (
                  <div
                    key={globalIndex}
                    className="bg-gray-700/50 rounded-lg border border-gray-600 overflow-hidden"
                  >
                    {/* Card header — click to expand */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : globalIndex)}
                      className="w-full px-3 py-2 text-left flex items-start gap-2"
                    >
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[s.category]}`}>
                        {CATEGORY_LABELS[s.category]}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          s.score >= 9 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          s.score >= 7 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          s.score >= 5 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}
                        data-testid={`score-${globalIndex}`}
                      >
                        {s.score}/10
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium truncate">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatMs(s.startMs)} → {formatMs(s.endMs)} · {durationSec}s
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Expanded content */}
                    {expanded && (() => {
                      const excerptSegments = transcript.filter(
                        seg => seg.endMs > s.startMs && seg.startMs < s.endMs
                      );
                      return (
                        <div className="px-3 pb-3 space-y-2 border-t border-gray-600">
                          <p className="text-xs text-gray-300 mt-2">{s.description}</p>
                          {excerptSegments.length > 0 && (
                            <div className="bg-gray-900/50 rounded p-2 max-h-32 overflow-y-auto" data-testid={`transcript-excerpt-${globalIndex}`}>
                              <p className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Transcrição</p>
                              <p className="text-xs text-gray-400 leading-relaxed">
                                {excerptSegments.map(seg => seg.text).join(' ')}
                              </p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {s.hashtags.map((h, j) => (
                              <span key={j} className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                {h}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSeek(s.startMs); }}
                              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded transition-colors"
                              data-testid={`visualize-${globalIndex}`}
                            >
                              Visualizar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onSetRange(s.startMs, s.endMs); }}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                              data-testid={`use-${globalIndex}`}
                            >
                              Usar
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2" data-testid="pagination">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="pagination-prev"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-gray-400" data-testid="pagination-info">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="pagination-next"
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
