interface YouTubePlayerProps {
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

export function YouTubePlayer({ containerRef, ready, currentTimeMs, durationMs }: YouTubePlayerProps) {
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
        <span className="text-white">{formatTime(currentTimeMs)}</span>
        <span>/</span>
        <span>{durationMs > 0 ? formatTime(durationMs) : '--:--'}</span>
      </div>
    </div>
  );
}
