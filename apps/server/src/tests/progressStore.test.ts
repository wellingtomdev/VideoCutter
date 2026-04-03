import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setPrepareProgress,
  getPrepareProgress,
  subscribePrepareProgress,
  clearPrepareProgress,
} from '../services/progressStore';

describe('progressStore — prepare progress', () => {
  const JOB_ID = 'test-job-123';

  beforeEach(() => {
    clearPrepareProgress(JOB_ID);
  });

  it('stores and retrieves prepare progress', () => {
    const data = { phase: 'downloading' as const, progress: 30, message: 'Baixando...', done: false };
    setPrepareProgress(JOB_ID, data);
    expect(getPrepareProgress(JOB_ID)).toEqual(data);
  });

  it('returns undefined for unknown job', () => {
    expect(getPrepareProgress('nonexistent')).toBeUndefined();
  });

  it('clears prepare progress', () => {
    setPrepareProgress(JOB_ID, { phase: 'done', progress: 100, message: 'Done', done: true });
    clearPrepareProgress(JOB_ID);
    expect(getPrepareProgress(JOB_ID)).toBeUndefined();
  });

  it('notifies subscribers on progress update', () => {
    const cb = vi.fn();
    subscribePrepareProgress(JOB_ID, cb);

    const data = { phase: 'downloading' as const, progress: 50, message: 'Downloading...', done: false };
    setPrepareProgress(JOB_ID, data);

    expect(cb).toHaveBeenCalledWith(data);
  });

  it('sends current state immediately on subscribe', () => {
    const data = { phase: 'merging' as const, progress: 70, message: 'Merging...', done: false };
    setPrepareProgress(JOB_ID, data);

    const cb = vi.fn();
    subscribePrepareProgress(JOB_ID, cb);

    expect(cb).toHaveBeenCalledWith(data);
  });

  it('unsubscribe stops notifications', () => {
    const cb = vi.fn();
    const unsub = subscribePrepareProgress(JOB_ID, cb);
    unsub();

    setPrepareProgress(JOB_ID, { phase: 'downloading', progress: 20, message: 'x', done: false });
    // Only the initial call (if any) should have happened, not the new update
    expect(cb).not.toHaveBeenCalledWith(
      expect.objectContaining({ progress: 20 }),
    );
  });

  it('supports multiple subscribers', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribePrepareProgress(JOB_ID, cb1);
    subscribePrepareProgress(JOB_ID, cb2);

    const data = { phase: 'downloading' as const, progress: 40, message: 'x', done: false };
    setPrepareProgress(JOB_ID, data);

    expect(cb1).toHaveBeenCalledWith(data);
    expect(cb2).toHaveBeenCalledWith(data);
  });

  it('tracks progress through full lifecycle (downloading → merging → done)', () => {
    const updates: any[] = [];
    subscribePrepareProgress(JOB_ID, (d) => updates.push(d));

    setPrepareProgress(JOB_ID, { phase: 'downloading', progress: 10, message: 'Start', done: false });
    setPrepareProgress(JOB_ID, { phase: 'merging', progress: 60, message: 'Merging', done: false });
    setPrepareProgress(JOB_ID, { phase: 'done', progress: 100, message: 'Done', done: true });

    expect(updates).toHaveLength(3);
    expect(updates[0].phase).toBe('downloading');
    expect(updates[1].phase).toBe('merging');
    expect(updates[2].phase).toBe('done');
    expect(updates[2].done).toBe(true);
  });
});
