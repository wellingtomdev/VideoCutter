import { describe, it, expect } from 'vitest';

function timeToPixel(timeMs: number, durationMs: number, width: number): number {
  if (durationMs === 0) return 0;
  return (timeMs / durationMs) * width;
}

function pixelToTime(x: number, durationMs: number, width: number): number {
  if (width === 0) return 0;
  const ratio = Math.max(0, Math.min(1, x / width));
  return Math.round(ratio * durationMs);
}

function clampHandle(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

describe('timeToPixel', () => {
  it('converts time to pixel position correctly', () => {
    expect(timeToPixel(5000, 10000, 200)).toBe(100);
    expect(timeToPixel(0, 10000, 200)).toBe(0);
    expect(timeToPixel(10000, 10000, 200)).toBe(200);
  });

  it('returns 0 when duration is 0', () => {
    expect(timeToPixel(5000, 0, 200)).toBe(0);
  });
});

describe('pixelToTime', () => {
  it('converts pixel position to time correctly', () => {
    expect(pixelToTime(100, 10000, 200)).toBe(5000);
    expect(pixelToTime(0, 10000, 200)).toBe(0);
    expect(pixelToTime(200, 10000, 200)).toBe(10000);
  });

  it('clamps values outside bounds', () => {
    expect(pixelToTime(-50, 10000, 200)).toBe(0);
    expect(pixelToTime(300, 10000, 200)).toBe(10000);
  });

  it('returns 0 when width is 0', () => {
    expect(pixelToTime(100, 10000, 0)).toBe(0);
  });
});

describe('clampHandle', () => {
  it('clamps value within range', () => {
    expect(clampHandle(50, 0, 100)).toBe(50);
    expect(clampHandle(-10, 0, 100)).toBe(0);
    expect(clampHandle(150, 0, 100)).toBe(100);
  });
});
