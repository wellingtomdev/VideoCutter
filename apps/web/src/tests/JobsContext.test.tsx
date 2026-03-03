import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { JobsProvider, useJobs } from '../contexts/JobsContext';
import type { Job } from '../types';

vi.mock('../services/api', () => ({
  api: {
    listJobs: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
  },
}));

import { api } from '../services/api';

const MOCK_JOB: Job = {
  id: 'job-1',
  title: 'Test Video',
  status: 'setup',
  source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_JOB_2: Job = {
  ...MOCK_JOB,
  id: 'job-2',
  title: 'Second Video',
};

function wrapper({ children }: { children: ReactNode }) {
  return <JobsProvider>{children}</JobsProvider>;
}

describe('JobsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listJobs).mockResolvedValue([MOCK_JOB]);
  });

  it('loads jobs on mount', async () => {
    const { result } = renderHook(() => useJobs(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].id).toBe('job-1');
    expect(api.listJobs).toHaveBeenCalledOnce();
  });

  it('createJob adds to list and sets as active', async () => {
    vi.mocked(api.createJob).mockResolvedValue(MOCK_JOB_2);

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createJob({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=xyz' },
      });
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs[0].id).toBe('job-2');
    expect(result.current.activeJobId).toBe('job-2');
  });

  it('selectJob changes activeJobId', async () => {
    vi.mocked(api.listJobs).mockResolvedValue([MOCK_JOB, MOCK_JOB_2]);

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectJob('job-2');
    });

    expect(result.current.activeJobId).toBe('job-2');
    expect(result.current.activeJob?.id).toBe('job-2');
  });

  it('updateJob updates job in list', async () => {
    const updated = { ...MOCK_JOB, status: 'done' as const, updatedAt: '2025-01-02T00:00:00.000Z' };
    vi.mocked(api.updateJob).mockResolvedValue(updated);

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateJob('job-1', { status: 'done' });
    });

    expect(result.current.jobs[0].status).toBe('done');
    expect(api.updateJob).toHaveBeenCalledWith('job-1', { status: 'done' });
  });

  it('deleteJob removes job and clears activeJobId if active', async () => {
    vi.mocked(api.deleteJob).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set as active first
    act(() => {
      result.current.selectJob('job-1');
    });

    expect(result.current.activeJobId).toBe('job-1');

    await act(async () => {
      await result.current.deleteJob('job-1');
    });

    expect(result.current.jobs).toHaveLength(0);
    expect(result.current.activeJobId).toBeNull();
  });

  it('throws when useJobs is used outside provider', () => {
    // Suppress console.error from React
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useJobs());
    }).toThrow(/must be used within/i);

    spy.mockRestore();
  });
});
