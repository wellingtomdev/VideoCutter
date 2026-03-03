import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAudioSync } from '../../hooks/useAudioSync';
import type { JobCutEntry, PrepareResult } from '../../types';

interface SyncEditorProps {
  prepareResult: PrepareResult;
  cuts?: JobCutEntry[];
  initialOffsetMs?: number;
  embedded?: boolean;
  onExport: (audioOffsetMs: number) => Promise<void>;
  onBack: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const msRem = Math.round(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(Math.floor(msRem / 100))}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

export function SyncEditor({ prepareResult, cuts, initialOffsetMs, embedded, onExport, onBack }: SyncEditorProps) {
  const streamUrl = api.streamUrl(prepareResult.filePath);
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [showCuts, setShowCuts] = useState(false);

  const {
    videoRef,
    audioRef,
    isPlaying,
    currentTimeMs,
    durationMs,
    offsetMs,
    setOffsetMs,
    togglePlay,
    seek,
  } = useAudioSync(streamUrl, prepareResult.paddingBeforeMs, prepareResult.originalDurationMs);

  // Pre-populate offset from prop (useful for re-export)
  useEffect(() => {
    if (initialOffsetMs != null && initialOffsetMs !== 0) {
      setOffsetMs(initialOffsetMs);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    setExportState('exporting');
    setExportError(null);
    try {
      await onExport(offsetMs);
      setExportState('done');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
      setExportState('error');
    }
  };

  const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  const exportButton = (
    <button
      onClick={handleExport}
      disabled={exportState === 'exporting'}
      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-5 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
    >
      {exportState === 'exporting' ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Exportando...
        </>
      ) : 'Exportar'}
    </button>
  );

  const cancelButton = (
    <button
      onClick={onBack}
      className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-1.5 rounded-lg border border-gray-600 hover:border-gray-500"
    >
      Cancelar
    </button>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-4 p-4 shrink-0">
        {/* Video player */}
        <div className="w-full max-w-4xl mx-auto">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={streamUrl}
              muted
              playsInline
              preload="auto"
              className="w-full max-h-[50vh]"
              onClick={togglePlay}
            />
            <audio ref={audioRef} src={streamUrl} preload="auto" />
          </div>

          {/* Progress bar */}
          <div
            className="mt-2 h-1.5 bg-gray-700 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(ratio * durationMs);
            }}
          >
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <span className="text-sm font-mono text-gray-300">
              {formatTime(currentTimeMs)} / {formatTime(durationMs)}
            </span>

            <div className="flex-1" />

            {/* Audio sync control */}
            <div className="flex items-center gap-2" title="Positivo = atrasa audio, Negativo = avanca audio">
              <label className="text-sm text-gray-400">Sincronia audio:</label>
              <input
                type="number"
                value={offsetMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setOffsetMs(isNaN(val) ? 0 : val);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white w-24 focus:outline-none focus:border-blue-500"
                step={50}
              />
              <span className="text-xs text-gray-500">ms</span>
              {offsetMs !== 0 && (
                <button
                  onClick={() => setOffsetMs(0)}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Positivo = atrasa audio &bull; Negativo = avanca audio &bull; Clique no video para play/pause
          </p>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-4xl mx-auto flex items-center gap-3">
          {exportButton}
        </div>

        {/* Export result messages */}
        {exportState === 'done' && (
          <div className="w-full max-w-4xl mx-auto bg-green-900/30 border border-green-700 rounded-lg px-4 py-2 text-sm">
            <span className="text-green-400 font-medium">Exportado com sucesso!</span>
          </div>
        )}

        {exportState === 'error' && exportError && (
          <div className="w-full max-w-4xl mx-auto bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-400">
            Erro: {exportError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 px-6 py-3 flex items-center justify-between border-b border-gray-700 shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Voltar
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Editor de Sincronia</h1>
          {cuts && cuts.length > 0 && (
            <button
              onClick={() => setShowCuts(!showCuts)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                showCuts
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {cuts.length} {cuts.length === 1 ? 'corte' : 'cortes'}
            </button>
          )}
        </div>
        {exportButton}
      </header>

      {/* Previous cuts panel */}
      {showCuts && cuts && cuts.length > 0 && (
        <div className="bg-gray-800/80 border-b border-gray-700 px-6 py-3 shrink-0">
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {cuts.map((cut) => (
              <div
                key={cut.id}
                className="flex items-center gap-3 bg-gray-700/40 rounded px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-green-400 shrink-0">
                  {cut.label}
                </span>
                <span className="text-gray-400 text-xs truncate min-w-0">
                  {formatTime(cut.output.durationMs)}
                  {cut.output.fileSize ? ` · ${formatFileSize(cut.output.fileSize)}` : ''}
                  {' · '}
                  {basename(cut.output.filePath)}
                </span>
                {cut.audioOffsetMs !== 0 && (
                  <span className="text-xs text-yellow-400/60 shrink-0">
                    offset: {cut.audioOffsetMs}ms
                  </span>
                )}
                <button
                  onClick={() => {
                    const w = window.open(api.streamUrl(cut.output.filePath), '_blank');
                    if (w) w.focus();
                  }}
                  className="ml-auto text-xs bg-gray-600 hover:bg-green-700 text-gray-300 hover:text-white px-2.5 py-0.5 rounded transition-colors shrink-0"
                >
                  Assistir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-4 overflow-y-auto">
        {/* Video player */}
        <div className="w-full max-w-4xl">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={streamUrl}
              muted
              playsInline
              preload="auto"
              className="w-full max-h-[60vh]"
              onClick={togglePlay}
            />
            {/* Hidden audio element for synced playback */}
            <audio ref={audioRef} src={streamUrl} preload="auto" />
          </div>

          {/* Progress bar */}
          <div
            className="mt-2 h-1.5 bg-gray-700 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(ratio * durationMs);
            }}
          >
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <span className="text-sm font-mono text-gray-300">
              {formatTime(currentTimeMs)} / {formatTime(durationMs)}
            </span>

            <div className="flex-1" />

            {/* Audio sync control */}
            <div className="flex items-center gap-2" title="Positivo = atrasa audio, Negativo = avanca audio">
              <label className="text-sm text-gray-400">Sincronia audio:</label>
              <input
                type="number"
                value={offsetMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setOffsetMs(isNaN(val) ? 0 : val);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white w-24 focus:outline-none focus:border-blue-500"
                step={50}
              />
              <span className="text-xs text-gray-500">ms</span>
              {offsetMs !== 0 && (
                <button
                  onClick={() => setOffsetMs(0)}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Positivo = atrasa audio &bull; Negativo = avanca audio &bull; Clique no video para play/pause
          </p>
        </div>

        {/* Export result messages */}
        {exportState === 'done' && (
          <div className="w-full max-w-4xl bg-green-900/30 border border-green-700 rounded-lg px-4 py-2 text-sm">
            <span className="text-green-400 font-medium">Exportado com sucesso!</span>
          </div>
        )}

        {exportState === 'error' && exportError && (
          <div className="w-full max-w-4xl bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-400">
            Erro: {exportError}
          </div>
        )}
      </main>
    </div>
  );
}
