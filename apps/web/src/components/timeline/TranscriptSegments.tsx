import type { TranscriptSegment } from '../../types';

interface TranscriptSegmentsProps {
  segments: TranscriptSegment[];
  durationMs: number;
  currentTimeMs: number;
  onSeek: (ms: number) => void;
}

const COLORS = [
  'bg-purple-600/60',
  'bg-indigo-600/60',
  'bg-teal-600/60',
  'bg-cyan-600/60',
  'bg-sky-600/60',
];

export function TranscriptSegments({
  segments,
  durationMs,
  currentTimeMs,
  onSeek,
}: TranscriptSegmentsProps) {
  if (!durationMs || segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => {
        const left = (seg.startMs / durationMs) * 100;
        const width = ((seg.endMs - seg.startMs) / durationMs) * 100;
        const isActive = currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs;
        const color = COLORS[i % COLORS.length];

        return (
          <div
            key={seg.id}
            className={`absolute inset-y-1 rounded ${color} ${isActive ? 'ring-1 ring-white' : ''} hover:brightness-125 transition-all`}
            style={{ left: `${left}%`, width: `${Math.max(width, 0.2)}%` }}
            title={seg.text}
            onClick={(e) => {
              e.stopPropagation();
              onSeek(seg.startMs);
            }}
          />
        );
      })}
    </>
  );
}
