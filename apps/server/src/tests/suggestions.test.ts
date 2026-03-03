import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

vi.mock('../services/jobStore', () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  getJobDir: vi.fn().mockReturnValue('/fake/jobs/123'),
  getJobsDir: vi.fn().mockReturnValue('/fake/jobs'),
}));

vi.mock('../services/llmService', () => ({
  suggestClips: vi.fn(),
}));

import { getJob, updateJob } from '../services/jobStore';
import { suggestClips } from '../services/llmService';
import type { Job } from '@video-cutter/types';

const MOCK_JOB: Job = {
  id: 'job-123',
  title: 'Test Video',
  status: 'ready',
  source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
  transcript: [
    { id: 1, startMs: 0, endMs: 10000, text: 'Primeiro segmento' },
    { id: 2, startMs: 10000, endMs: 20000, text: 'Segundo segmento' },
    { id: 3, startMs: 20000, endMs: 30000, text: 'Terceiro segmento' },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_SUGGESTIONS = [
  {
    startMs: 0,
    endMs: 20000,
    title: 'Momento impactante',
    description: 'Um trecho poderoso do sermão',
    hashtags: ['#fe', '#pregacao'],
    category: 'exortacao' as const,
  },
];

describe('POST /suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when jobId is missing', async () => {
    const res = await request(app).post('/suggestions').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobId/);
  });

  it('returns 404 when job does not exist', async () => {
    vi.mocked(getJob).mockRejectedValue(new Error('Job not found'));

    const res = await request(app).post('/suggestions').send({ jobId: 'nonexistent' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/i);
  });

  it('returns 400 when job has no transcript', async () => {
    const jobNoTranscript = { ...MOCK_JOB, transcript: [] };
    vi.mocked(getJob).mockResolvedValue(jobNoTranscript);

    const res = await request(app).post('/suggestions').send({ jobId: 'job-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transcrição/i);
  });

  it('returns 400 when job transcript is undefined', async () => {
    const jobNoTranscript = { ...MOCK_JOB, transcript: undefined };
    vi.mocked(getJob).mockResolvedValue(jobNoTranscript);

    const res = await request(app).post('/suggestions').send({ jobId: 'job-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transcrição/i);
  });

  it('returns 200 with suggestions on success', async () => {
    vi.mocked(getJob).mockResolvedValue(MOCK_JOB);
    vi.mocked(suggestClips).mockResolvedValue(MOCK_SUGGESTIONS);
    vi.mocked(updateJob).mockResolvedValue({ ...MOCK_JOB, suggestions: MOCK_SUGGESTIONS });

    const res = await request(app).post('/suggestions').send({ jobId: 'job-123' });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0].title).toBe('Momento impactante');
  });

  it('persists suggestions via updateJob', async () => {
    vi.mocked(getJob).mockResolvedValue(MOCK_JOB);
    vi.mocked(suggestClips).mockResolvedValue(MOCK_SUGGESTIONS);
    vi.mocked(updateJob).mockResolvedValue({ ...MOCK_JOB, suggestions: MOCK_SUGGESTIONS });

    await request(app).post('/suggestions').send({ jobId: 'job-123' });

    expect(updateJob).toHaveBeenCalledWith('job-123', { suggestions: MOCK_SUGGESTIONS });
  });

  it('passes rangeStartMs, rangeEndMs, and categories to suggestClips', async () => {
    vi.mocked(getJob).mockResolvedValue(MOCK_JOB);
    vi.mocked(suggestClips).mockResolvedValue([]);
    vi.mocked(updateJob).mockResolvedValue({ ...MOCK_JOB, suggestions: [] });

    await request(app).post('/suggestions').send({
      jobId: 'job-123',
      rangeStartMs: 5000,
      rangeEndMs: 25000,
      categories: ['ensino', 'humor'],
    });

    expect(suggestClips).toHaveBeenCalledWith({
      segments: MOCK_JOB.transcript,
      rangeStartMs: 5000,
      rangeEndMs: 25000,
      categories: ['ensino', 'humor'],
    });
  });

  it('returns 500 when suggestClips throws (e.g., no API key)', async () => {
    vi.mocked(getJob).mockResolvedValue(MOCK_JOB);
    vi.mocked(suggestClips).mockRejectedValue(new Error('OPENAI_API_KEY não configurada'));

    const res = await request(app).post('/suggestions').send({ jobId: 'job-123' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/OPENAI_API_KEY/);
  });
});
