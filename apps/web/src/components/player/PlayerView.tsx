interface PlayerViewProps {
  type: 'youtube' | 'local';
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  currentTimeMs: number;
  durationMs: number;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlayerView({ type, containerRef, ready, currentTimeMs, durationMs }: PlayerViewProps) {
  return (
    <div className="w-full max-w-4xl mx-auto shrink-0 bg-black rounded-lg overflow-hidden">
      {/* 16:9 responsive container */}
      <div className="relative w-full aspect-video min-h-[240px]">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <svg className="animate-spin w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {/* Time display bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-xs font-mono text-gray-400">
        {type === 'local' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-gray-500 shrink-0">
            <rect x="2" y="6" width="15" height="12" rx="2" />
            <path d="M17 9l5-3v12l-5-3V9z" />
          </svg>
        )}
        {type === 'youtube' && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-red-500 shrink-0">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )}
        <span className="text-white">{formatTime(currentTimeMs)}</span>
        <span>/</span>
        <span>{durationMs > 0 ? formatTime(durationMs) : '--:--'}</span>
      </div>
    </div>
  );
}
