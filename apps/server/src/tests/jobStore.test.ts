import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Set JOBS_DIR to a temp directory before importing jobStore
const testJobsDir = path.join(os.tmpdir(), `jobstore-test-${Date.now()}`);
process.env.JOBS_DIR = testJobsDir;

import { createJob, getJob, listJobs, updateJob, deleteJob, getJobDir, getJobsDir } from '../services/jobStore';

describe('jobStore', () => {
  beforeEach(() => {
    // Ensure clean state
    if (fs.existsSync(testJobsDir)) {
      fs.rmSync(testJobsDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testJobsDir)) {
      fs.rmSync(testJobsDir, { recursive: true, force: true });
    }
  });

  describe('getJobsDir', () => {
    it('returns the JOBS_DIR env var', () => {
      expect(getJobsDir()).toBe(testJobsDir);
    });
  });

  describe('createJob', () => {
    it('creates a folder and metadata.json with correct fields', async () => {
      const job = await createJob({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
      });

      expect(job.id).toBeTruthy();
      expect(job.status).toBe('setup');
      expect(job.source.type).toBe('youtube');
      expect(job.source.youtubeUrl).toBe('https://youtube.com/watch?v=abc');
      expect(job.createdAt).toBeTruthy();
      expect(job.updatedAt).toBeTruthy();

      const dir = getJobDir(job.id);
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.existsSync(path.join(dir, 'metadata.json'))).toBe(true);
    });

    it('generates a title from YouTube videoId when no title given', async () => {
      const job = await createJob({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=xyz', videoId: 'xyz' },
      });

      expect(job.title).toBe('YouTube - xyz');
    });

    it('generates a title from local file path when no title given', async () => {
      const job = await createJob({
        source: { type: 'local', path: '/videos/my_great_video.mp4' },
      });

      expect(job.title).toBe('my_great_video');
    });

    it('uses provided title when given', async () => {
      const job = await createJob({
        title: 'Custom Title',
        source: { type: 'local', path: '/videos/test.mp4' },
      });

      expect(job.title).toBe('Custom Title');
    });

    it('saves transcript if provided', async () => {
      const transcript = [{ id: 1, startMs: 0, endMs: 1000, text: 'Hello' }];
      const job = await createJob({
        source: { type: 'local', path: '/test.mp4' },
        transcript,
      });

      expect(job.transcript).toEqual(transcript);
    });
  });

  describe('getJob', () => {
    it('reads and returns an existing job', async () => {
      const created = await createJob({
        source: { type: 'local', path: '/test.mp4' },
      });

      const fetched = await getJob(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe(created.title);
      expect(fetched.source).toEqual(created.source);
    });

    it('throws for a non-existent ID', async () => {
      await expect(getJob('non-existent-id')).rejects.toThrow(/not found/i);
    });
  });

  describe('listJobs', () => {
    it('returns an empty array if no jobs exist', async () => {
      const jobs = await listJobs();
      expect(jobs).toEqual([]);
    });

    it('returns all jobs ordered by createdAt desc', async () => {
      const job1 = await createJob({ source: { type: 'local', path: '/a.mp4' } });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const job2 = await createJob({ source: { type: 'local', path: '/b.mp4' } });

      const jobs = await listJobs();
      expect(jobs).toHaveLength(2);
      expect(jobs[0].id).toBe(job2.id);
      expect(jobs[1].id).toBe(job1.id);
    });

    it('skips directories without metadata.json', async () => {
      await createJob({ source: { type: 'local', path: '/a.mp4' } });
      // Create a rogue directory
      fs.mkdirSync(path.join(testJobsDir, 'rogue-dir'), { recursive: true });

      const jobs = await listJobs();
      expect(jobs).toHaveLength(1);
    });
  });

  describe('updateJob', () => {
    it('merges partial updates and updates updatedAt', async () => {
      const created = await createJob({ source: { type: 'local', path: '/test.mp4' } });
      const originalUpdatedAt = created.updatedAt;

      await new Promise(r => setTimeout(r, 10));

      const updated = await updateJob(created.id, {
        status: 'done',
        output: { filePath: '/out.mp4', durationMs: 5000 },
      });

      expect(updated.status).toBe('done');
      expect(updated.output?.filePath).toBe('/out.mp4');
      expect(updated.source).toEqual(created.source);
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('throws for a non-existent ID', async () => {
      await expect(updateJob('non-existent', { status: 'done' })).rejects.toThrow(/not found/i);
    });

    it('persists suggestions and recovers them on getJob', async () => {
      const created = await createJob({
        source: { type: 'local', path: '/test.mp4' },
        transcript: [{ id: 1, startMs: 0, endMs: 10000, text: 'Hello' }],
      });

      const suggestions = [
        {
          startMs: 0,
          endMs: 30000,
          title: 'Momento impactante',
          description: 'Trecho poderoso',
          hashtags: ['#fe'],
          category: 'exortacao' as const,
        },
      ];

      await updateJob(created.id, { suggestions });

      // Re-read from disk (simulates restart)
      const recovered = await getJob(created.id);
      expect(recovered.suggestions).toEqual(suggestions);
    });

    it('preserves suggestions when updating other fields', async () => {
      const created = await createJob({
        source: { type: 'local', path: '/test.mp4' },
      });

      const suggestions = [
        {
          startMs: 0,
          endMs: 20000,
          title: 'Clip A',
          description: 'Desc',
          hashtags: ['#tag'],
          category: 'ensino' as const,
        },
      ];

      // Save suggestions
      await updateJob(created.id, { suggestions });

      // Update status (without touching suggestions)
      const updated = await updateJob(created.id, { status: 'ready' });

      expect(updated.status).toBe('ready');
      expect(updated.suggestions).toEqual(suggestions);

      // Verify on disk too
      const fromDisk = await getJob(created.id);
      expect(fromDisk.suggestions).toEqual(suggestions);
    });
  });

  describe('updateJob — transcript', () => {
    it('preserves transcript when not provided in update', async () => {
      const transcript = [
        { id: 0, startMs: 0, endMs: 5000, text: 'Hello' },
        { id: 1, startMs: 5000, endMs: 10000, text: 'World' },
      ];
      const created = await createJob({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
        transcript,
      });

      const updated = await updateJob(created.id, { status: 'ready' });
      expect(updated.transcript).toEqual(transcript);
    });

    it('updates transcript when provided in update', async () => {
      const created = await createJob({
        source: { type: 'youtube', youtubeUrl: 'https://youtube.com/watch?v=abc', videoId: 'abc' },
      });
      expect(created.transcript).toBeUndefined();

      const transcript = [
        { id: 0, startMs: 0, endMs: 3000, text: 'New transcript' },
      ];
      const updated = await updateJob(created.id, { transcript });
      expect(updated.transcript).toEqual(transcript);

      // Verify on disk
      const fromDisk = await getJob(created.id);
      expect(fromDisk.transcript).toEqual(transcript);
    });
  });

  describe('deleteJob', () => {
    it('removes the job folder recursively', async () => {
      const job = await createJob({ source: { type: 'local', path: '/test.mp4' } });
      const dir = getJobDir(job.id);
      expect(fs.existsSync(dir)).toBe(true);

      await deleteJob(job.id);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('throws for a non-existent ID', async () => {
      await expect(deleteJob('non-existent')).rejects.toThrow(/not found/i);
    });
  });
});
