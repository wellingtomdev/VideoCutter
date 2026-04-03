import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { TranscriptSegment } from '../../types';

interface TranscriptListProps {
  segments: TranscriptSegment[];
  currentTimeMs: number;
  startMs: number;
  endMs: number;
  onSeek: (ms: number) => void;
  onSetStart: (ms: number) => void;
  onSetEnd: (ms: number) => void;
  onRetryTranscript?: () => void;
  transcriptLoading?: boolean;
  transcriptError?: string | null;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-500/40 text-yellow-200 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function TranscriptList({
  segments,
  currentTimeMs,
  startMs,
  endMs,
  onSeek,
  onSetStart,
  onSetEnd,
  onRetryTranscript,
  transcriptLoading,
  transcriptError,
}: TranscriptListProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const prevActiveIdRef = useRef<number | undefined>(undefined);

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const query = searchQuery.trim().toLowerCase();
  const matches: number[] = query
    ? segments
        .map((seg, i) => (seg.text.toLowerCase().includes(query) ? i : -1))
        .filter((i) => i !== -1)
    : [];

  const currentMatchIdx = matches.length > 0
    ? Math.min(matchIndex, matches.length - 1)
    : -1;

  // Reset to first match when query changes
  useEffect(() => {
    setMatchIndex(0);
  }, [searchQuery]);

  // Auto-scroll to focused match
  useEffect(() => {
    if (currentMatchIdx >= 0) {
      matchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMatchIdx, matches.length]);

  const goPrev = () => {
    if (matches.length === 0) return;
    setMatchIndex((currentMatchIdx - 1 + matches.length) % matches.length);
  };

  const goNext = () => {
    if (matches.length === 0) return;
    setMatchIndex((currentMatchIdx + 1) % matches.length);
  };

  // ── Active segment auto-scroll ────────────────────────────────────────────
  // Last segment whose startMs <= currentTimeMs (segments are sorted).
  // YouTube segments have overlapping durations so find() picks a stale one.
  const activeId = segments.reduce<number | undefined>(
    (best, s) => (s.startMs <= currentTimeMs ? s.id : best),
    undefined,
  );

  useEffect(() => {
    if (activeId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeId;
      // Only auto-scroll for active segment if not searching
      if (!query) {
        activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeId, query]);

  if (segments.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 flex flex-col h-full min-h-48">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Transcrição</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            {transcriptLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                <p className="text-gray-400 text-sm">Buscando transcrição...</p>
              </div>
            ) : (
              <>
                <p className="text-gray-500 text-sm">Sem transcrição disponível</p>
                {transcriptError && (
                  <p className="text-xs text-red-400/70">{transcriptError}</p>
                )}
                {onRetryTranscript && (
                  <button
                    onClick={onRetryTranscript}
                    className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Buscar transcrição do YouTube
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasSelection = segments.length > 0 && (startMs > 0 || endMs < segments[segments.length - 1].endMs);

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-semibold text-gray-300">Transcrição</h3>
        <span className="text-xs text-gray-500">{segments.length} segmentos</span>
      </div>

      {hasSelection && (
        <div className="text-xs text-blue-400 mb-2 shrink-0 flex items-center gap-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
          </svg>
          Seleção: {formatTime(startMs)} → {formatTime(endMs)}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.shiftKey ? goPrev() : goNext();
            }
            if (e.key === 'Escape') {
              setSearchQuery('');
            }
          }}
          placeholder="Buscar na Transcrição..."
          className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        {query && (
          <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
            {matches.length > 0
              ? `${currentMatchIdx + 1} de ${matches.length}`
              : '0 de 0'}
          </span>
        )}

        <button
          onClick={goPrev}
          disabled={matches.length === 0}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Anterior (Shift+Enter)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={matches.length === 0}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Proximo (Enter)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-2 shrink-0">
        Clique para definir inicio &bull; <kbd className="bg-gray-700 px-1 rounded">Shift</kbd>+clique para definir fim
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {segments.map((seg, idx) => {
          const isActive = seg.id === activeId;
          const inRange = seg.startMs >= startMs && seg.endMs <= endMs;
          const isStart = seg.startMs === startMs;
          const isEnd = seg.endMs === endMs;
          const isMatch = query ? seg.text.toLowerCase().includes(query) : false;
          const isFocusedMatch = isMatch && matches[currentMatchIdx] === idx;

          return (
            <div
              key={seg.id}
              ref={isFocusedMatch ? matchRef : isActive ? activeRef : undefined}
              className={`group flex items-start gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors select-none
                ${inRange ? 'border-l-2 border-l-green-500' : ''}
                ${isFocusedMatch
                  ? 'bg-yellow-900/50 border border-yellow-600/50 ring-1 ring-yellow-500/30'
                  : isMatch
                  ? 'bg-yellow-900/20'
                  : isActive
                  ? 'bg-blue-900/50 border border-blue-700/50'
                  : inRange
                  ? 'bg-green-900/20 hover:bg-green-900/30'
                  : 'hover:bg-gray-700/50'
                }`}
              onClick={(e) => {
                if (e.shiftKey) {
                  onSetEnd(seg.endMs);
                  onSeek(seg.startMs);
                } else {
                  onSetStart(seg.startMs);
                  onSeek(seg.startMs);
                }
              }}
            >
              <span className={`text-xs font-mono shrink-0 w-12 pt-0.5 ${isActive ? 'text-blue-300' : 'text-gray-500'}`}>
                {formatTime(seg.startMs)}
              </span>

              <span className={`flex-1 text-xs leading-relaxed ${isActive ? 'text-white' : 'text-gray-300'}`}>
                {highlightText(seg.text, query)}
              </span>

              <div className={`flex flex-col gap-0.5 shrink-0 transition-opacity ${isStart || isEnd ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button
                  title="Definir como inicio"
                  onClick={(e) => { e.stopPropagation(); onSetStart(seg.startMs); onSeek(seg.startMs); }}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors
                    ${isStart
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-900/40 text-blue-400 hover:bg-blue-700/60 hover:text-blue-200'
                    }`}
                >
                  I
                </button>
                <button
                  title="Definir como fim"
                  onClick={(e) => { e.stopPropagation(); onSetEnd(seg.endMs); onSeek(seg.startMs); }}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors
                    ${isEnd
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-900/40 text-purple-400 hover:bg-purple-700/60 hover:text-purple-200'
                    }`}
                >
                  F
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
