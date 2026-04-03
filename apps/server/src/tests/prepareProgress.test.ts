import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { setPrepareProgress, clearPrepareProgress } from '../services/progressStore';

describe('GET /cut/prepare-progress/:jobId', () => {
  const JOB_ID = 'progress-test-123';

  beforeEach(() => {
    clearPrepareProgress(JOB_ID);
  });

  it('returns SSE content-type header', async () => {
    // Set progress before request so the subscribe fires immediately
    setPrepareProgress(JOB_ID, { phase: 'done', progress: 100, message: 'Done', done: true });

    const res = await request(app).get(`/cut/prepare-progress/${JOB_ID}`);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('streams progress data and closes when done', async () => {
    setPrepareProgress(JOB_ID, { phase: 'done', progress: 100, message: 'Done', done: true });

    const res = await request(app).get(`/cut/prepare-progress/${JOB_ID}`);
    expect(res.text).toContain('data: ');

    const dataLine = res.text.split('\n').find(l => l.startsWith('data: '));
    expect(dataLine).toBeDefined();

    const parsed = JSON.parse(dataLine!.replace('data: ', ''));
    expect(parsed.phase).toBe('done');
    expect(parsed.progress).toBe(100);
    expect(parsed.done).toBe(true);
  });

  it('sends current state immediately on subscribe', async () => {
    setPrepareProgress(JOB_ID, { phase: 'downloading', progress: 30, message: 'Downloading...', done: false });

    // Since the state is not "done", we need to complete it during the request
    // Set a timer to mark it done
    setTimeout(() => {
      setPrepareProgress(JOB_ID, { phase: 'done', progress: 100, message: 'Done', done: true });
    }, 50);

    const res = await request(app).get(`/cut/prepare-progress/${JOB_ID}`);
    const lines = res.text.split('\n').filter(l => l.startsWith('data: '));

    expect(lines.length).toBeGreaterThanOrEqual(2);

    const first = JSON.parse(lines[0].replace('data: ', ''));
    expect(first.phase).toBe('downloading');
    expect(first.progress).toBe(30);

    const last = JSON.parse(lines[lines.length - 1].replace('data: ', ''));
    expect(last.phase).toBe('done');
    expect(last.done).toBe(true);
  });

  it('closes connection on error phase', async () => {
    setPrepareProgress(JOB_ID, { phase: 'error', progress: 0, message: 'Failed', done: false, error: 'Test error' });

    const res = await request(app).get(`/cut/prepare-progress/${JOB_ID}`);
    const dataLine = res.text.split('\n').find(l => l.startsWith('data: '));
    const parsed = JSON.parse(dataLine!.replace('data: ', ''));

    expect(parsed.phase).toBe('error');
    expect(parsed.error).toBe('Test error');
  });
});
