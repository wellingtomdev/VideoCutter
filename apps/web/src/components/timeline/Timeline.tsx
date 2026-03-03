import { useRef } from 'react';
import { TranscriptSegments } from './TranscriptSegments';
import { Playhead } from './Playhead';
import { CutHandles } from './CutHandles';
import type { TranscriptSegment } from '../../types';

interface TimelineProps {
  segments: TranscriptSegment[];
  durationMs: number;
  currentTimeMs: number;
  startMs: number;
  endMs: number;
  onSeek: (ms: number) => void;
  onStartChange: (ms: number) => void;
  onEndChange: (ms: number) => void;
}

export function Timeline({
  segments,
  durationMs,
  currentTimeMs,
  startMs,
  endMs,
  onSeek,
  onStartChange,
  onEndChange,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getTimeFromX = (clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || durationMs === 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * durationMs);
  };

  const handleClick = (e: React.MouseEvent) => {
    onSeek(getTimeFromX(e.clientX));
  };

  const startPercent = durationMs > 0 ? (startMs / durationMs) * 100 : 0;
  const endPercent = durationMs > 0 ? (endMs / durationMs) * 100 : 100;

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Timeline</h3>
      <div
        ref={containerRef}
        className="relative h-14 bg-gray-700 rounded-lg overflow-visible cursor-pointer select-none"
        onClick={handleClick}
      >
        {/* Selection overlay */}
        <div
          className="absolute inset-y-0 bg-blue-500/20 border-x-2 border-blue-500/50 pointer-events-none"
          style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
        />

        <TranscriptSegments
          segments={segments}
          durationMs={durationMs}
          currentTimeMs={currentTimeMs}
          onSeek={onSeek}
        />

        <Playhead currentTimeMs={currentTimeMs} durationMs={durationMs} />

        <CutHandles
          startMs={startMs}
          endMs={endMs}
          durationMs={durationMs}
          containerRef={containerRef}
          onStartChange={onStartChange}
          onEndChange={onEndChange}
        />
      </div>
    </div>
  );
}
