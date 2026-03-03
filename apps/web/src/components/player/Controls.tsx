interface ControlsProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Controls({ currentTimeMs, durationMs, isPlaying, onTogglePlay, onSeek }: ControlsProps) {
  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="bg-gray-900 px-4 py-3 space-y-2">
      {/* Progress bar */}
      <div
        className="h-1.5 bg-gray-700 rounded-full cursor-pointer relative"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          onSeek(Math.round(ratio * durationMs));
        }}
      >
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 flex items-center justify-center text-white hover:text-blue-400 transition-colors"
          aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <span className="text-sm text-gray-300 font-mono">
          {formatTime(currentTimeMs)} / {formatTime(durationMs)}
        </span>
      </div>
    </div>
  );
}
