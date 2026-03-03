import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptSegments } from '../components/timeline/TranscriptSegments';
import type { TranscriptSegment } from '../types';

const segments: TranscriptSegment[] = [
  { id: 0, startMs: 0, endMs: 5000, text: 'Hello world' },
  { id: 1, startMs: 5000, endMs: 10000, text: 'Second segment' },
];

describe('TranscriptSegments', () => {
  it('renders transcript segments', () => {
    const onSeek = vi.fn();
    const { container } = render(
      <TranscriptSegments
        segments={segments}
        durationMs={10000}
        currentTimeMs={0}
        onSeek={onSeek}
      />
    );
    const divs = container.querySelectorAll('[title]');
    expect(divs.length).toBe(2);
  });

  it('calls onSeek when segment is clicked', () => {
    const onSeek = vi.fn();
    const { container } = render(
      <TranscriptSegments
        segments={segments}
        durationMs={10000}
        currentTimeMs={0}
        onSeek={onSeek}
      />
    );
    const firstSeg = container.querySelector('[title="Hello world"]') as HTMLElement;
    fireEvent.click(firstSeg);
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('highlights the active segment containing currentTime', () => {
    const { container } = render(
      <TranscriptSegments
        segments={segments}
        durationMs={10000}
        currentTimeMs={2500}
        onSeek={vi.fn()}
      />
    );
    const activeSeg = container.querySelector('[title="Hello world"]') as HTMLElement;
    expect(activeSeg.className).toContain('ring-1');
  });
});
