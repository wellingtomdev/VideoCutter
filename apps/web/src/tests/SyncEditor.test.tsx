import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SyncEditor } from '../components/editor/SyncEditor';
import type { PrepareResult } from '../types';

// Mock useAudioSync to avoid real media element interactions
const mockSetOffsetMs = vi.fn();

vi.mock('../hooks/useAudioSync', () => ({
  useAudioSync: () => ({
    videoRef: { current: null },
    audioRef: { current: null },
    isPlaying: false,
    currentTimeMs: 0,
    durationMs: 30000,
    offsetMs: 0,
    setOffsetMs: mockSetOffsetMs,
    togglePlay: vi.fn(),
    seek: vi.fn(),
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    streamUrl: (path: string) => `http://localhost:3001/stream?path=${encodeURIComponent(path)}`,
  },
}));

const PREPARE_RESULT: PrepareResult = {
  filePath: '/tmp/prepared.mp4',
  paddingBeforeMs: 2000,
  paddingAfterMs: 2000,
  originalDurationMs: 30000,
};

describe('SyncEditor', () => {
  it('renders the sync editor header and controls', () => {
    const { getByText } = render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(getByText('Editor de Sincronia')).toBeTruthy();
    expect(getByText('Voltar')).toBeTruthy();
    expect(getByText('Exportar')).toBeTruthy();
  });

  it('calls setOffsetMs with initialOffsetMs on mount', () => {
    render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        initialOffsetMs={250}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(mockSetOffsetMs).toHaveBeenCalledWith(250);
  });

  it('does NOT call setOffsetMs when initialOffsetMs is 0', () => {
    mockSetOffsetMs.mockClear();

    render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        initialOffsetMs={0}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(mockSetOffsetMs).not.toHaveBeenCalled();
  });

  it('does NOT call setOffsetMs when initialOffsetMs is undefined', () => {
    mockSetOffsetMs.mockClear();

    render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(mockSetOffsetMs).not.toHaveBeenCalled();
  });

  it('shows the cuts badge when cuts are provided', () => {
    const cuts = [{
      id: 'c1',
      label: '0:10 → 0:30',
      startMs: 10000,
      endMs: 30000,
      audioOffsetMs: 0,
      output: { filePath: '/output/c1.mp4', durationMs: 20000 },
      createdAt: '2025-01-01T00:00:00.000Z',
    }];

    const { getByText } = render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        cuts={cuts}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(getByText('1 corte')).toBeTruthy();
  });

  it('shows plural cuts badge for multiple cuts', () => {
    const cuts = [
      {
        id: 'c1', label: 'A', startMs: 0, endMs: 10000, audioOffsetMs: 0,
        output: { filePath: '/a.mp4', durationMs: 10000 }, createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'c2', label: 'B', startMs: 10000, endMs: 20000, audioOffsetMs: 0,
        output: { filePath: '/b.mp4', durationMs: 10000 }, createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];

    const { getByText } = render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        cuts={cuts}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(getByText('2 cortes')).toBeTruthy();
  });

  it('does not show cuts badge when no cuts are provided', () => {
    const { queryByText } = render(
      <SyncEditor
        prepareResult={PREPARE_RESULT}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(queryByText(/corte/)).toBeNull();
  });
});
