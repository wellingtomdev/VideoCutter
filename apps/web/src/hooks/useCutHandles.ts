import { useState, useCallback } from 'react';

export function useCutHandles(durationMs: number) {
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(durationMs);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const pixelToTime = useCallback(
    (x: number, containerWidth: number): number => {
      const ratio = clamp(x / containerWidth, 0, 1);
      return Math.round(ratio * durationMs);
    },
    [durationMs]
  );

  const setStart = useCallback(
    (ms: number) => {
      setStartMs((prev) => {
        const clamped = clamp(ms, 0, endMs - 1);
        return clamped;
      });
    },
    [endMs]
  );

  const setEnd = useCallback(
    (ms: number) => {
      setEndMs((prev) => {
        const clamped = clamp(ms, startMs + 1, durationMs);
        return clamped;
      });
    },
    [startMs, durationMs]
  );

  // Set both handles at once (avoids stale-closure clamping issues)
  const setRange = useCallback(
    (start: number, end: number) => {
      const s = clamp(start, 0, durationMs - 1);
      const e = clamp(end, s + 1, durationMs);
      setStartMs(s);
      setEndMs(e);
    },
    [durationMs]
  );

  // Reset when duration changes
  const reset = useCallback(() => {
    setStartMs(0);
    setEndMs(durationMs);
  }, [durationMs]);

  return { startMs, endMs, setStartMs: setStart, setEndMs: setEnd, setRange, pixelToTime, reset };
}
