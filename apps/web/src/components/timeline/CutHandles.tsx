import React, { useRef } from 'react';

interface CutHandlesProps {
  startMs: number;
  endMs: number;
  durationMs: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onStartChange: (ms: number) => void;
  onEndChange: (ms: number) => void;
}

export function CutHandles({
  startMs,
  endMs,
  durationMs,
  containerRef,
  onStartChange,
  onEndChange,
}: CutHandlesProps) {
  if (!durationMs) return null;

  const startPercent = (startMs / durationMs) * 100;
  const endPercent = (endMs / durationMs) * 100;

  const getTimeFromClientX = (clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * durationMs);
  };

  const handleStartDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      onStartChange(getTimeFromClientX(ev.clientX));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleEndDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      onEndChange(getTimeFromClientX(ev.clientX));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {/* START handle */}
      <div
        className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group"
        style={{ left: `${startPercent}%`, touchAction: 'none' }}
        onPointerDown={handleStartDrag}
        title={`Start: ${(startMs / 1000).toFixed(3)}s`}
      >
        <div className="w-2 h-full bg-green-500 rounded-sm opacity-90 group-hover:opacity-100 group-hover:w-2.5 transition-all" />
      </div>

      {/* END handle */}
      <div
        className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group"
        style={{ left: `${endPercent}%`, touchAction: 'none' }}
        onPointerDown={handleEndDrag}
        title={`End: ${(endMs / 1000).toFixed(3)}s`}
      >
        <div className="w-2 h-full bg-red-500 rounded-sm opacity-90 group-hover:opacity-100 group-hover:w-2.5 transition-all" />
      </div>
    </>
  );
}
