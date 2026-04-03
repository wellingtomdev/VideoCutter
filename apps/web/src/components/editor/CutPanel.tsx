import type { CutResponse } from '../../types';

export type CutMode = 'youtube' | 'local';

interface CutPanelProps {
  startMs: number;
  endMs: number;
  onStartChange: (ms: number) => void;
  onEndChange: (ms: number) => void;
  cutMode: CutMode;
  onCutModeChange: (mode: CutMode) => void;
  localVideoPath: string | null;
  onSelectLocalFile: () => void;
  onCut: () => void;
  cutState: 'idle' | 'preparing' | 'error';
  cutError: string | null;
}

function msToTimeString(ms: number): string {
  const totalMs = Math.max(0, ms);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const msRem = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msRem).padStart(3, '0')}`;
}

function timeStringToMs(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

const TAB = 'px-3 py-1.5 text-sm rounded-md transition-colors font-medium';
const ACTIVE = 'bg-gray-700 text-white';
const INACTIVE = 'text-gray-400 hover:text-gray-200';

export function CutPanel({
  startMs,
  endMs,
  onStartChange,
  onEndChange,
  cutMode,
  onCutModeChange,
  localVideoPath,
  onSelectLocalFile,
  onCut,
  cutState,
  cutError,
}: CutPanelProps) {
  const durationMs = endMs - startMs;
  const durationSec = (durationMs / 1000).toFixed(1);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = timeStringToMs(e.target.value);
    if (ms !== null) onStartChange(ms);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = timeStringToMs(e.target.value);
    if (ms !== null) onEndChange(ms);
  };

  const canCut =
    durationMs > 0 &&
    (cutMode === 'youtube' || !!localVideoPath);

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Mode + time range row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Source mode toggle */}
        <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1 shrink-0">
          <button
            type="button"
            onClick={() => onCutModeChange('youtube')}
            className={`${TAB} ${cutMode === 'youtube' ? ACTIVE : INACTIVE}`}
          >
            YouTube
          </button>
          <button
            type="button"
            onClick={() => onCutModeChange('local')}
            className={`${TAB} ${cutMode === 'local' ? ACTIVE : INACTIVE}`}
          >
            Arquivo local
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Inicio:</label>
          <input
            type="text"
            value={msToTimeString(startMs)}
            onChange={handleStartChange}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white w-36 focus:outline-none focus:border-blue-500"
            placeholder="00:00:00.000"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Fim:</label>
          <input
            type="text"
            value={msToTimeString(endMs)}
            onChange={handleEndChange}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-white w-36 focus:outline-none focus:border-blue-500"
            placeholder="00:00:00.000"
          />
        </div>

        <span className="text-sm text-gray-400">
          Duracao: <span className="text-white font-mono">{durationSec}s</span>
        </span>
      </div>

      {/* Source-specific controls + cut button */}
      <div className="flex items-center gap-3 flex-wrap">
        {cutMode === 'youtube' ? (
          <p className="text-xs text-gray-500">
            O clip sera baixado diretamente do YouTube (ate 720p)
          </p>
        ) : (
          <button
            type="button"
            onClick={onSelectLocalFile}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors
              ${localVideoPath
                ? 'border-green-700 bg-green-900/20 text-green-400 hover:border-green-500'
                : 'border-dashed border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
              <rect x="2" y="6" width="15" height="12" rx="2" />
              <path d="M17 9l5-3v12l-5-3V9z" />
            </svg>
            {localVideoPath
              ? <span className="truncate max-w-[200px]">{basename(localVideoPath)}</span>
              : 'Selecionar arquivo local...'
            }
          </button>
        )}

        <button
          onClick={onCut}
          disabled={!canCut}
          title={cutMode === 'local' && !localVideoPath ? 'Selecione o arquivo local primeiro' : undefined}
          className="ml-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          {cutState === 'preparing' ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Preparando...
            </>
          ) : (
            'Recortar Clip'
          )}
        </button>
      </div>

      {cutState === 'error' && cutError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-400">
          Erro: {cutError}
        </div>
      )}
    </div>
  );
}
