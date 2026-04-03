import { useState, useEffect, useRef } from 'react';
import { PlayerView } from '../player/PlayerView';
import { Timeline } from '../timeline/Timeline';
import { CutPanel, type CutMode } from './CutPanel';
import { TranscriptList } from '../transcript/TranscriptList';
import { ClipSuggestions } from './ClipSuggestions';
import { SyncEditor } from './SyncEditor';
import { CutsTab } from './CutsTab';
import { usePlayer } from '../../hooks/usePlayer';
import { useCutHandles } from '../../hooks/useCutHandles';
import { useJobs } from '../../contexts/JobsContext';
import { api } from '../../services/api';
import { downloadFile } from '../../utils/downloadFile';
import type { Job, JobCutEntry, PrepareResult, PrepareProgress, TranscriptSegment } from '../../types';

interface EditorPanelProps {
  job: Job;
}

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

type EditorTab = 'recortar' | 'cortes';

const TAB = 'px-3 py-1.5 text-sm rounded-md transition-colors font-medium';
const ACTIVE = 'bg-gray-700 text-white';
const INACTIVE = 'text-gray-400 hover:text-gray-200';

export function EditorPanel({ job }: EditorPanelProps) {
  const { updateJob, refreshJob } = useJobs();
  const [localVideoPath, setLocalVideoPath] = useState<string | null>(job.source.path ?? null);
  const [cutMode, setCutMode] = useState<CutMode>(job.source.type === 'youtube' ? 'youtube' : 'local');

  // Tab state
  const [activeTab, setActiveTab] = useState<EditorTab>('recortar');
  const [reExportOffsetMs, setReExportOffsetMs] = useState<number | undefined>(undefined);

  // Cut/prepare state
  const [cutState, setCutState] = useState<'idle' | 'preparing' | 'error'>('idle');
  const [cutError, setCutError] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [preparingLabel, setPreparingLabel] = useState<string | null>(null);
  const [prepareProgress, setPrepareProgress] = useState<PrepareProgress | null>(null);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  const prepareAbortRef = useRef<AbortController | null>(null);

  const segments: TranscriptSegment[] = job.transcript ?? [];
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const handleRetryTranscript = async () => {
    if (job.source.type !== 'youtube' || !job.source.youtubeUrl) return;
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const transcript = await api.youtubeTranscript(job.source.youtubeUrl);
      await updateJob(job.id, { transcript });
      await refreshJob(job.id);
    } catch (err) {
      setTranscriptError(err instanceof Error ? err.message : 'Falha ao buscar transcrição');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const { containerRef, currentTimeMs, durationMs, isPlaying, ready, seek, type: playerType } =
    usePlayer(job.source);

  const { startMs, endMs, setStartMs, setEndMs, setRange, reset } = useCutHandles(durationMs);

  // Loop: volta ao startMs quando o player atinge endMs
  useEffect(() => {
    if (isPlaying && endMs < durationMs && currentTimeMs >= endMs) {
      seek(startMs);
    }
  }, [currentTimeMs, endMs, startMs, durationMs, isPlaying, seek]);

  // Reset cut handles once YouTube player reports real duration
  const prevDurationRef = useRef(0);
  useEffect(() => {
    if (durationMs > 0 && prevDurationRef.current === 0) {
      reset();
    }
    prevDurationRef.current = durationMs;
  }, [durationMs, reset]);

  // Restore cut range from job if available
  useEffect(() => {
    if (job.cut) {
      setStartMs(job.cut.startMs);
      setEndMs(job.cut.endMs);
    }
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when job changes — restore prepareResult if backend has one
  useEffect(() => {
    // Abort any in-flight prepare from the previous job
    prepareAbortRef.current?.abort();
    prepareAbortRef.current = null;

    setCutError(null);
    setSelectedCutId(null);
    setLocalVideoPath(job.source.path ?? null);
    setCutMode(job.source.type === 'youtube' ? 'youtube' : 'local');
    setReExportOffsetMs(undefined);
    setCutState('idle');
    setPreparingLabel(null);
    setPrepareProgress(null);

    if (job.prepare) {
      setPrepareResult(job.prepare);
      setActiveTab('cortes');
    } else {
      setPrepareResult(null);
      setActiveTab('recortar');
    }

    // If the job is stuck in 'preparing' from a previous session (server restart),
    // reset it back to setup so the user isn't stuck
    if (job.status === 'preparing' && !job.prepare) {
      updateJob(job.id, { status: 'setup' }).catch(() => {});
    }
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE progress subscription — only while cutState is 'preparing'
  useEffect(() => {
    if (cutState !== 'preparing' || job.source.type !== 'youtube') return;

    const unsub = api.subscribePrepareProgress(job.id, (data) => {
      setPrepareProgress(data);
    });

    return () => unsub();
  }, [cutState, job.id, job.source.type]);

  const handleCancelPrepare = async () => {
    // Abort the in-flight HTTP request
    prepareAbortRef.current?.abort();
    prepareAbortRef.current = null;

    // Reset local state
    setCutState('idle');
    setCutError(null);
    setPreparingLabel(null);
    setPrepareProgress(null);
    setActiveTab('recortar');

    // Reset job status on backend
    try {
      const hasExistingCuts = (job.cuts?.length ?? 0) > 0;
      await updateJob(job.id, { status: hasExistingCuts ? 'ready' : 'setup' });
    } catch { /* ignore */ }
  };

  const handleSelectLocalFile = async () => {
    try {
      const path = await api.openFileDialog('video', 'Selecionar arquivo local para exportar');
      if (path) setLocalVideoPath(path);
    } catch {
      // user cancelled or error
    }
  };

  const handleCut = async () => {
    // Abort any previous in-flight prepare
    prepareAbortRef.current?.abort();
    const abortController = new AbortController();
    prepareAbortRef.current = abortController;

    setCutState('preparing');
    setCutError(null);
    setPrepareProgress(null);
    setPreparingLabel(`${formatMs(startMs)} → ${formatMs(endMs)}`);
    setActiveTab('cortes');

    // SSE subscription is handled by the useEffect that watches cutState === 'preparing'

    try {
      await updateJob(job.id, { status: 'preparing', cut: { startMs, endMs, audioOffsetMs: 0 } });

      const req = cutMode === 'youtube'
        ? { youtubeUrl: job.source.youtubeUrl!, startMs, endMs, jobId: job.id }
        : { videoPath: localVideoPath!, startMs, endMs, jobId: job.id };

      const result = await api.prepare(req, abortController.signal);

      // If this prepare was aborted (user cancelled or started a new one), ignore the result
      if (abortController.signal.aborted) return;

      // Show SyncEditor so user can preview and adjust audio offset before finalizing
      setPrepareResult(result);
      setCutState('idle');
      setPreparingLabel(null);
      setPrepareProgress(null);
      await updateJob(job.id, { status: 'ready' });
    } catch (err) {
      // Ignore abort errors (user cancelled or started a new prepare)
      if (abortController.signal.aborted) return;

      setCutError(err instanceof Error ? err.message : String(err));
      setCutState('error');
      setPrepareProgress(null);
      try { await updateJob(job.id, { status: 'error', error: String(err) }); } catch {}
    }
  };

  const handleExport = async (audioOffsetMs: number): Promise<void> => {
    if (!prepareResult) throw new Error('No prepared file');

    const finalResult = await api.finalize({
      sourcePath: prepareResult.filePath,
      trimStartMs: prepareResult.paddingBeforeMs,
      trimDurationMs: prepareResult.originalDurationMs,
      audioOffsetMs,
      jobId: job.id,
    });

    // Backend already updated the job (status → ready, newCutEntry appended)
    await refreshJob(job.id);
    setPrepareResult(null);
    setSelectedCutId(null);
    setReExportOffsetMs(undefined);
    setActiveTab('cortes');

    // Offer download
    if (finalResult.outputPath) {
      await downloadFile(api.streamUrl(finalResult.outputPath), basename(finalResult.outputPath));
    }
  };

  const handleSelectCut = (cut: JobCutEntry) => {
    setSelectedCutId(cut.id);
    setReExportOffsetMs(cut.audioOffsetMs);
    setCutState('idle');
    setCutError(null);
    setPreparingLabel(null);
    setPrepareResult({
      filePath: cut.output.filePath,
      paddingBeforeMs: 0,
      paddingAfterMs: 0,
      originalDurationMs: cut.output.durationMs,
    });
  };

  const handleDeleteCut = async (cut: JobCutEntry) => {
    // If the deleted cut was selected, clear selection
    if (selectedCutId === cut.id) {
      setSelectedCutId(null);
      setPrepareResult(null);
      setReExportOffsetMs(undefined);
    }
    await updateJob(job.id, { removeCutId: cut.id });
    await refreshJob(job.id);
  };

  const handleDownloadCut = async (cut: JobCutEntry) => {
    await downloadFile(api.streamUrl(cut.output.filePath), basename(cut.output.filePath));
  };

  // Active transcript segment
  const activeSegment = segments.reduce<TranscriptSegment | undefined>(
    (best, s) => (s.startMs <= currentTimeMs ? s : best),
    undefined,
  );

  // Build unified cuts list (includes legacy single-output jobs)
  const allCuts: JobCutEntry[] = (() => {
    if (job.cuts && job.cuts.length > 0) return job.cuts;
    if (job.output) {
      return [{
        id: 'legacy',
        label: job.cut
          ? `${formatMs(job.cut.startMs)} → ${formatMs(job.cut.endMs)}`
          : 'Corte',
        startMs: job.cut?.startMs ?? 0,
        endMs: job.cut?.endMs ?? 0,
        audioOffsetMs: job.cut?.audioOffsetMs ?? 0,
        output: job.output,
        createdAt: job.updatedAt,
      }];
    }
    return [];
  })();
  const cutsCount = allCuts.length;

  // ── Main editor view ──────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Error banner */}
      {job.status === 'error' && job.error && (
        <div className="bg-red-900/30 border-b border-red-700 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-400">Erro: {job.error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-3 py-1.5 flex gap-1 shrink-0">
        <button
          className={`${TAB} ${activeTab === 'recortar' ? ACTIVE : INACTIVE}`}
          onClick={() => setActiveTab('recortar')}
        >
          Recortar
        </button>
        <button
          className={`${TAB} ${activeTab === 'cortes' ? ACTIVE : INACTIVE}`}
          onClick={() => setActiveTab('cortes')}
        >
          Cortes{cutsCount > 0 ? ` (${cutsCount})` : ''}
        </button>
      </div>

      {/* Recortar tab — always mounted, hidden via CSS to preserve YouTube player */}
      <div className={`flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden ${activeTab !== 'recortar' ? 'hidden' : ''}`}>
        {/* Left column: player + timeline + controls */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <PlayerView
            type={playerType}
            containerRef={containerRef}
            ready={ready}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
          />

          <div className="bg-gray-800 rounded-lg p-3 shrink-0">
            <Timeline
              segments={segments}
              durationMs={durationMs}
              currentTimeMs={currentTimeMs}
              startMs={startMs}
              endMs={endMs}
              onSeek={seek}
              onStartChange={setStartMs}
              onEndChange={setEndMs}
            />

            {activeSegment && (
              <p className="mt-2 text-sm text-gray-300 italic line-clamp-2">
                "{activeSegment.text}"
              </p>
            )}
          </div>

          <CutPanel
            startMs={startMs}
            endMs={endMs}
            onStartChange={setStartMs}
            onEndChange={setEndMs}
            cutMode={cutMode}
            onCutModeChange={setCutMode}
            localVideoPath={localVideoPath}
            onSelectLocalFile={handleSelectLocalFile}
            onCut={handleCut}
            cutState={cutState}
            cutError={cutError}
          />

          <ClipSuggestions
            jobId={job.id}
            transcript={segments}
            suggestions={job.suggestions ?? []}
            startMs={startMs}
            endMs={endMs}
            durationMs={durationMs}
            onSeek={seek}
            onSetRange={setRange}
            onSuggestionsGenerated={() => refreshJob(job.id)}
          />
        </div>

        {/* Right column: transcript */}
        <div className="w-full h-64 shrink-0 lg:h-auto lg:w-72 xl:w-80 lg:min-h-0 flex flex-col overflow-hidden">
          <TranscriptList
            segments={segments}
            currentTimeMs={currentTimeMs}
            startMs={startMs}
            endMs={endMs}
            onSeek={seek}
            onSetStart={setStartMs}
            onSetEnd={setEndMs}
            onRetryTranscript={job.source.type === 'youtube' ? handleRetryTranscript : undefined}
            transcriptLoading={transcriptLoading}
            transcriptError={transcriptError}
          />
        </div>
      </div>

      {/* Cortes tab */}
      <div className={`flex-1 min-h-0 flex flex-col overflow-y-auto ${activeTab !== 'cortes' ? 'hidden' : ''}`}>
        {/* Preparing indicator with progress */}
        {cutState === 'preparing' && (
          <div className="shrink-0 mx-4 mt-4 bg-gray-800 rounded-lg p-4 border border-blue-700/50">
            <div className="flex items-center gap-3">
              <svg className="animate-spin w-5 h-5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-400 font-medium">
                    {prepareProgress?.message ?? 'Preparando corte...'}
                  </p>
                  <button
                    onClick={handleCancelPrepare}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-900/30 shrink-0"
                    title="Cancelar processamento"
                  >
                    Cancelar
                  </button>
                </div>
                {preparingLabel && (
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{preparingLabel}</p>
                )}
                {prepareProgress && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">
                        {prepareProgress.phase === 'downloading' && 'Baixando do YouTube...'}
                        {prepareProgress.phase === 'merging' && 'Processando vídeo...'}
                        {prepareProgress.phase === 'done' && 'Concluído!'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{prepareProgress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${prepareProgress.progress}%` }}
                      />
                    </div>
                    {prepareProgress.phase === 'downloading' && prepareProgress.message && (
                      <p className="text-xs text-gray-500 mt-1.5 font-mono truncate">
                        {prepareProgress.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Error indicator */}
        {cutState === 'error' && cutError && (
          <div className="shrink-0 mx-4 mt-4 bg-red-900/30 rounded-lg p-4 border border-red-700">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400 shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-400 font-medium">Erro ao preparar corte</p>
                <p className="text-xs text-red-400/70 mt-0.5">{cutError}</p>
              </div>
            </div>
          </div>
        )}
        {prepareResult && (
          <SyncEditor
            prepareResult={prepareResult}
            initialOffsetMs={reExportOffsetMs}
            embedded
            onExport={handleExport}
            onBack={() => { setPrepareResult(null); setSelectedCutId(null); }}
          />
        )}
        {cutsCount > 0 && (
          <CutsTab
            cuts={allCuts}
            onSelect={handleSelectCut}
            onDelete={handleDeleteCut}
            onDownload={handleDownloadCut}
            selectedCutId={selectedCutId}
          />
        )}
        {cutState === 'idle' && !prepareResult && cutsCount === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-12 h-12 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm">Nenhum corte realizado ainda.</p>
            <button
              onClick={() => setActiveTab('recortar')}
              className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              Ir para Recortar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
