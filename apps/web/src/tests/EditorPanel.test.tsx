import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { EditorPanel } from '../components/editor/EditorPanel';
import type { Job, JobCutEntry } from '../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../hooks/useYouTubePlayer', () => ({
  useYouTubePlayer: () => ({
    containerRef: { current: null },
    currentTimeMs: 0,
    durationMs: 60000,
    isPlaying: false,
    ready: true,
    seek: vi.fn(),
  }),
}));

vi.mock('../hooks/useCutHandles', () => ({
  useCutHandles: () => ({
    startMs: 0,
    endMs: 60000,
    setStartMs: vi.fn(),
    setEndMs: vi.fn(),
    setRange: vi.fn(),
    reset: vi.fn(),
  }),
}));

const mockUpdateJob = vi.fn().mockResolvedValue({});
const mockRefreshJob = vi.fn().mockResolvedValue({});

vi.mock('../contexts/JobsContext', () => ({
  useJobs: () => ({
    updateJob: mockUpdateJob,
    refreshJob: mockRefreshJob,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    prepare: vi.fn(),
    finalize: vi.fn(),
    streamUrl: (path: string) => `http://localhost:3001/stream?path=${encodeURIComponent(path)}`,
    openFileDialog: vi.fn(),
  },
}));

vi.mock('../utils/downloadFile', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
}));

// Stub heavy child components to keep tests fast and focused
vi.mock('../components/player/YouTubePlayer', () => ({
  YouTubePlayer: () => <div data-testid="youtube-player" />,
}));

vi.mock('../components/timeline/Timeline', () => ({
  Timeline: () => <div data-testid="timeline" />,
}));

vi.mock('../components/editor/CutPanel', () => ({
  CutPanel: ({ onCut }: { onCut: () => void }) => (
    <div data-testid="cut-panel">
      <button data-testid="cut-button" onClick={onCut}>Cortar</button>
    </div>
  ),
}));

vi.mock('../components/transcript/TranscriptList', () => ({
  TranscriptList: () => <div data-testid="transcript-list" />,
}));

vi.mock('../components/editor/ClipSuggestions', () => ({
  ClipSuggestions: () => <div data-testid="clip-suggestions" />,
}));

vi.mock('../components/editor/SyncEditor', () => ({
  SyncEditor: ({ initialOffsetMs }: { initialOffsetMs?: number }) => (
    <div data-testid="sync-editor">
      <span data-testid="initial-offset">{initialOffsetMs ?? 'none'}</span>
    </div>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_JOB: Job = {
  id: 'job-1',
  title: 'Test Video',
  status: 'ready',
  source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const makeCutEntry = (id: string): JobCutEntry => ({
  id,
  label: `0:10 → 0:30`,
  startMs: 10000,
  endMs: 30000,
  audioOffsetMs: 100,
  output: { filePath: `/output/cut-${id}.mp4`, durationMs: 20000, fileSize: 2097152 },
  createdAt: '2025-06-15T14:30:00.000Z',
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EditorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Tab rendering ──

  it('renders both "Recortar" and "Cortes" tabs', () => {
    const { getByText } = render(<EditorPanel job={BASE_JOB} />);

    expect(getByText('Recortar')).toBeTruthy();
    expect(getByText('Cortes')).toBeTruthy();
  });

  it('starts on the "Recortar" tab by default', () => {
    const { getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    // The main editor elements should be visible
    expect(getByTestId('youtube-player')).toBeTruthy();
    expect(getByTestId('cut-panel')).toBeTruthy();
  });

  it('shows cuts count in the "Cortes" tab when there are cuts', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1'), makeCutEntry('c2')] };
    const { getByText } = render(<EditorPanel job={job} />);

    expect(getByText('Cortes (2)')).toBeTruthy();
  });

  it('shows no count in the "Cortes" tab when there are no cuts', () => {
    const { getByText, queryByText } = render(<EditorPanel job={BASE_JOB} />);

    expect(getByText('Cortes')).toBeTruthy();
    expect(queryByText(/Cortes \(/)).toBeNull();
  });

  // ── Tab switching ──

  it('switches to "Cortes" tab when clicked', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));

    // Player stays in DOM but its container is hidden
    expect(getByTestId('youtube-player').closest('.hidden')).toBeTruthy();
    // Cut card should be visible
    expect(getByText('0:10 → 0:30')).toBeTruthy();
  });

  it('switches back to "Recortar" tab when clicked', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId, queryByText } = render(<EditorPanel job={job} />);

    // Switch to Cortes
    fireEvent.click(getByText('Cortes (1)'));
    expect(getByText('0:10 → 0:30')).toBeTruthy();

    // Switch back to Recortar
    fireEvent.click(getByText('Recortar'));
    expect(getByTestId('youtube-player')).toBeTruthy();
  });

  // ── Empty Cortes tab ──

  it('shows empty state in Cortes tab when no cuts exist', () => {
    const { getByText } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByText('Cortes'));
    expect(getByText('Nenhum corte realizado ainda.')).toBeTruthy();
  });

  it('has a link in empty Cortes tab that navigates to Recortar', () => {
    const { getByText, getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByText('Cortes'));
    fireEvent.click(getByText('Ir para Recortar'));

    expect(getByTestId('youtube-player')).toBeTruthy();
  });

  // ── Legacy job support ──

  it('shows legacy output as a cut in the Cortes tab', () => {
    const job: Job = {
      ...BASE_JOB,
      status: 'done',
      output: { filePath: '/output/legacy.mp4', durationMs: 15000, fileSize: 1024000 },
      cut: { startMs: 5000, endMs: 20000, audioOffsetMs: 0 },
    };
    const { getByText } = render(<EditorPanel job={job} />);

    // Should show count including legacy
    expect(getByText('Cortes (1)')).toBeTruthy();

    fireEvent.click(getByText('Cortes (1)'));
    // Should display the legacy cut label (formatted from startMs/endMs)
    expect(getByText('0:05 → 0:20')).toBeTruthy();
  });

  it('shows "Corte" label for legacy jobs without cut range info', () => {
    const job: Job = {
      ...BASE_JOB,
      status: 'done',
      output: { filePath: '/output/legacy.mp4', durationMs: 15000 },
    };
    const { getByText } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));
    expect(getByText('Corte')).toBeTruthy();
  });

  it('prefers job.cuts over legacy output when both exist', () => {
    const job: Job = {
      ...BASE_JOB,
      status: 'done',
      output: { filePath: '/output/legacy.mp4', durationMs: 15000 },
      cuts: [makeCutEntry('c1')],
    };
    const { getByText, queryByText } = render(<EditorPanel job={job} />);

    // Should only show 1 (the cuts entry, not the legacy)
    expect(getByText('Cortes (1)')).toBeTruthy();
    fireEvent.click(getByText('Cortes (1)'));

    // Should show the real cut label, not "Corte" (legacy)
    expect(getByText('0:10 → 0:30')).toBeTruthy();
    expect(queryByText('Corte')).toBeNull();
  });

  // ── Error banner ──

  it('shows error banner when job has error', () => {
    const job: Job = { ...BASE_JOB, status: 'error', error: 'FFmpeg failed' };
    const { getByText } = render(<EditorPanel job={job} />);

    expect(getByText('Erro: FFmpeg failed')).toBeTruthy();
  });

  it('does not show error banner when there is no error', () => {
    const { queryByText } = render(<EditorPanel job={BASE_JOB} />);

    expect(queryByText(/^Erro:/)).toBeNull();
  });

  // ── No legacy banner ──

  it('does NOT show the old output banner for legacy jobs', () => {
    const job: Job = {
      ...BASE_JOB,
      status: 'done',
      output: { filePath: '/output/legacy.mp4', durationMs: 15000 },
    };
    const { queryByText } = render(<EditorPanel job={job} />);

    expect(queryByText('Video cortado com sucesso')).toBeNull();
  });

  // ── Cut flow — prepare then show SyncEditor ──

  it('switches to Cortes tab and shows SyncEditor after prepare completes', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.prepare).mockResolvedValue({
      filePath: '/tmp/prepared.mp4',
      paddingBeforeMs: 2000,
      paddingAfterMs: 2000,
      originalDurationMs: 20000,
    });

    const { getByText, getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByTestId('cut-button'));

    // Should immediately switch to Cortes tab and show preparing indicator
    await waitFor(() => {
      expect(getByText('Preparando corte...')).toBeTruthy();
    });

    // After prepare, SyncEditor should appear (user can preview and adjust audio offset)
    await waitFor(() => {
      expect(getByTestId('sync-editor')).toBeTruthy();
    });

    // Finalize should NOT be called automatically — user must click "Exportar" in SyncEditor
    expect(api.finalize).not.toHaveBeenCalled();
  });

  it('shows preparing label with time range in Cortes tab', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.prepare).mockImplementation(() => new Promise(() => {})); // never resolves

    const { getByText, getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByTestId('cut-button'));

    await waitFor(() => {
      expect(getByText('Preparando corte...')).toBeTruthy();
      // Should show the time range label (0:00 → 1:00 for startMs=0 endMs=60000)
      expect(getByText('0:00 → 1:00')).toBeTruthy();
    });
  });

  it('shows error in Cortes tab when prepare fails', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.prepare).mockRejectedValue(new Error('Download failed'));

    const { getByText, getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByTestId('cut-button'));

    await waitFor(() => {
      expect(getByText('Erro ao preparar corte')).toBeTruthy();
      expect(getByText('Download failed')).toBeTruthy();
    });
  });

  // ── Select cut flow ──

  it('opens SyncEditor with cut file when selecting a cut', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));
    fireEvent.click(getByText('Selecionar'));

    // SyncEditor should open with the cut's audioOffsetMs
    expect(getByTestId('sync-editor')).toBeTruthy();
    expect(getByTestId('initial-offset').textContent).toBe('100');
  });

  it('keeps cuts list visible while SyncEditor is active', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1'), makeCutEntry('c2')] };
    const { getByText, getByTestId, getAllByText } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (2)'));
    fireEvent.click(getAllByText('Selecionar')[0]);

    expect(getByTestId('sync-editor')).toBeTruthy();
    // Cuts list should still be visible
    expect(getAllByText('0:10 → 0:30').length).toBeGreaterThanOrEqual(1);
    // One should show "Selecionado", the other "Selecionar"
    expect(getByText('Selecionado')).toBeTruthy();
    expect(getAllByText('Selecionar')).toHaveLength(1);
  });

  // ── Prepare restore ──

  it('restores SyncEditor when job has a saved prepare result', () => {
    const job: Job = {
      ...BASE_JOB,
      status: 'preparing',
      prepare: {
        filePath: '/tmp/prepared.mp4',
        paddingBeforeMs: 2000,
        paddingAfterMs: 2000,
        originalDurationMs: 20000,
      },
    };
    const { getByTestId, getByText } = render(<EditorPanel job={job} />);

    // SyncEditor should be shown (restored from job.prepare)
    expect(getByTestId('sync-editor')).toBeTruthy();
    // Should start on Cortes tab
    expect(getByText('Recortar')).toBeTruthy();
  });

  it('does NOT open SyncEditor when job has no prepare result', () => {
    const { queryByTestId, getByText } = render(<EditorPanel job={BASE_JOB} />);

    expect(queryByTestId('sync-editor')).toBeNull();
    expect(getByText('Recortar')).toBeTruthy();
  });

  // ── Delete cut ──

  it('shows delete button for each cut in Cortes tab', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1'), makeCutEntry('c2')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (2)'));

    expect(getByTestId('delete-c1')).toBeTruthy();
    expect(getByTestId('delete-c2')).toBeTruthy();
  });

  it('shows confirmation buttons when delete is clicked', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));
    fireEvent.click(getByTestId('delete-c1'));

    expect(getByTestId('confirm-delete-c1')).toBeTruthy();
    expect(getByTestId('cancel-delete-c1')).toBeTruthy();
  });

  it('calls updateJob with removeCutId when confirming delete', async () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));
    fireEvent.click(getByTestId('delete-c1'));
    fireEvent.click(getByTestId('confirm-delete-c1'));

    await waitFor(() => {
      expect(mockUpdateJob).toHaveBeenCalledWith('job-1', { removeCutId: 'c1' });
      expect(mockRefreshJob).toHaveBeenCalledWith('job-1');
    });
  });

  it('clears selection when deleting the selected cut', async () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1'), makeCutEntry('c2')] };
    const { getByText, getByTestId, getAllByText, queryByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (2)'));

    // Select cut c1
    fireEvent.click(getAllByText('Selecionar')[0]);
    expect(getByTestId('sync-editor')).toBeTruthy();

    // Now delete c1
    fireEvent.click(getByTestId('delete-c1'));
    fireEvent.click(getByTestId('confirm-delete-c1'));

    await waitFor(() => {
      expect(mockUpdateJob).toHaveBeenCalledWith('job-1', { removeCutId: 'c1' });
      // SyncEditor should be closed since the selected cut was deleted
      expect(queryByTestId('sync-editor')).toBeNull();
    });
  });

  // ── Download cut ──

  it('shows download button for each cut in Cortes tab', () => {
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));

    expect(getByTestId('download-c1')).toBeTruthy();
  });

  it('calls downloadFile when clicking "Baixar" on a cut', async () => {
    const { downloadFile } = await import('../utils/downloadFile');
    const job: Job = { ...BASE_JOB, cuts: [makeCutEntry('c1')] };
    const { getByText, getByTestId } = render(<EditorPanel job={job} />);

    fireEvent.click(getByText('Cortes (1)'));
    fireEvent.click(getByTestId('download-c1'));

    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledWith(
        expect.stringContaining('/stream?path='),
        'cut-c1.mp4',
      );
    });
  });

  it('does NOT auto-download after prepare — waits for user to export via SyncEditor', async () => {
    const { api } = await import('../services/api');
    const { downloadFile } = await import('../utils/downloadFile');
    vi.mocked(api.prepare).mockResolvedValue({
      filePath: '/tmp/prepared.mp4',
      paddingBeforeMs: 2000,
      paddingAfterMs: 2000,
      originalDurationMs: 20000,
    });

    const { getByTestId } = render(<EditorPanel job={BASE_JOB} />);

    fireEvent.click(getByTestId('cut-button'));

    // Wait for SyncEditor to appear
    await waitFor(() => {
      expect(getByTestId('sync-editor')).toBeTruthy();
    });

    // Download should NOT have been triggered — user needs to click "Exportar" first
    expect(downloadFile).not.toHaveBeenCalled();
    expect(api.finalize).not.toHaveBeenCalled();
  });
});
