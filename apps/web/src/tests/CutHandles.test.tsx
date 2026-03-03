import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { CutHandles } from '../components/timeline/CutHandles';

function TestWrapper({ startMs, endMs, durationMs, onStartChange, onEndChange }: {
  startMs: number;
  endMs: number;
  durationMs: number;
  onStartChange: (ms: number) => void;
  onEndChange: (ms: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ width: 1000, position: 'relative' }}>
      <CutHandles
        startMs={startMs}
        endMs={endMs}
        durationMs={durationMs}
        containerRef={ref}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />
    </div>
  );
}

describe('CutHandles', () => {
  it('renders start and end handles', () => {
    const { container } = render(
      <TestWrapper
        startMs={0}
        endMs={10000}
        durationMs={10000}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />
    );
    const handles = container.querySelectorAll('[title]');
    expect(handles.length).toBe(2);
  });

  it('start handle is positioned at 0%', () => {
    const { container } = render(
      <TestWrapper
        startMs={0}
        endMs={10000}
        durationMs={10000}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />
    );
    const startHandle = container.querySelector('[title^="Start"]') as HTMLElement;
    expect(startHandle.style.left).toBe('0%');
  });

  it('end handle is positioned at 100%', () => {
    const { container } = render(
      <TestWrapper
        startMs={0}
        endMs={10000}
        durationMs={10000}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />
    );
    const endHandle = container.querySelector('[title^="End"]') as HTMLElement;
    expect(endHandle.style.left).toBe('100%');
  });
});
