interface PlayheadProps {
  currentTimeMs: number;
  durationMs: number;
}

export function Playhead({ currentTimeMs, durationMs }: PlayheadProps) {
  if (!durationMs) return null;

  const left = (currentTimeMs / durationMs) * 100;

  return (
    <div
      className="absolute inset-y-0 w-0.5 bg-yellow-400 pointer-events-none z-10"
      style={{ left: `${left}%` }}
    >
      <div className="w-2 h-2 bg-yellow-400 rounded-full absolute -top-1 -translate-x-1/2" />
    </div>
  );
}
