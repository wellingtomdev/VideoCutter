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

import { createJob, getJob, listJobs, updateJob, deleteJob } from '../services/jobStore';

const MOCK_JOB = {
  id: 'test-uuid-123',
  title: 'Test Video',
  status: 'setup' as const,
  source: { type: 'youtube' as const, youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('Jobs Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /jobs', () => {
    it('returns a list of jobs', async () => {
      vi.mocked(listJobs).mockResolvedValue([MOCK_JOB]);

      const res = await request(app).get('/jobs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('test-uuid-123');
    });

    it('returns empty array when no jobs exist', async () => {
      vi.mocked(listJobs).mockResolvedValue([]);

      const res = await request(app).get('/jobs');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /jobs', () => {
    it('creates a job and returns 201', async () => {
      vi.mocked(createJob).mockResolvedValue(MOCK_JOB);

      const res = await request(app).post('/jobs').send({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc' },
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('test-uuid-123');
      expect(createJob).toHaveBeenCalledWith({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc' },
      });
    });

    it('returns 400 when source is missing', async () => {
      const res = await request(app).post('/jobs').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/source/i);
    });

    it('returns 400 when source type is missing', async () => {
      const res = await request(app).post('/jobs').send({ source: {} });
      expect(res.status).toBe(400);
    });

    it('returns 400 when YouTube source lacks youtubeUrl', async () => {
      const res = await request(app).post('/jobs').send({
        source: { type: 'youtube' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/youtubeUrl/i);
    });

    it('returns 400 when local source lacks path', async () => {
      const res = await request(app).post('/jobs').send({
        source: { type: 'local' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/path/i);
    });
  });

  describe('GET /jobs/:id', () => {
    it('returns a job by ID', async () => {
      vi.mocked(getJob).mockResolvedValue(MOCK_JOB);

      const res = await request(app).get('/jobs/test-uuid-123');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('test-uuid-123');
    });

    it('returns 404 for non-existent ID', async () => {
      vi.mocked(getJob).mockRejectedValue(new Error('Job not found: xyz'));

      const res = await request(app).get('/jobs/xyz');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('PATCH /jobs/:id', () => {
    it('updates and returns the job', async () => {
      const updated = { ...MOCK_JOB, status: 'done' as const, updatedAt: '2025-01-02T00:00:00.000Z' };
      vi.mocked(updateJob).mockResolvedValue(updated);

      const res = await request(app).patch('/jobs/test-uuid-123').send({ status: 'done' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(updateJob).toHaveBeenCalledWith('test-uuid-123', { status: 'done' });
    });

    it('returns 404 for non-existent ID', async () => {
      vi.mocked(updateJob).mockRejectedValue(new Error('Job not found: xyz'));

      const res = await request(app).patch('/jobs/xyz').send({ status: 'done' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /jobs/:id', () => {
    it('deletes and returns 204', async () => {
      vi.mocked(deleteJob).mockResolvedValue(undefined);

      const res = await request(app).delete('/jobs/test-uuid-123');
      expect(res.status).toBe(204);
      expect(deleteJob).toHaveBeenCalledWith('test-uuid-123');
    });

    it('returns 404 for non-existent ID', async () => {
      vi.mocked(deleteJob).mockRejectedValue(new Error('Job not found: xyz'));

      const res = await request(app).delete('/jobs/xyz');
      expect(res.status).toBe(404);
    });
  });
});
