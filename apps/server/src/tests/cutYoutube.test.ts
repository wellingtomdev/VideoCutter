import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

// Mock the entire service so the route tests are fast and deterministic
vi.mock('../services/youtubeDownloadService', () => ({
  cutYoutubeVideo: vi.fn(),
}));

import { cutYoutubeVideo } from '../services/youtubeDownloadService';

const TEST_URL = 'https://www.youtube.com/watch?v=86PGRyQjdzQ';

describe('POST /cut/youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cutYoutubeVideo).mockResolvedValue({
      outputPath: '/fake/output/yt_cut_123.mp4',
      durationMs: 10000,
    });
  });

  it('returns 400 when youtubeUrl is missing', async () => {
    const res = await request(app).post('/cut/youtube').send({ startMs: 0, endMs: 10000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it('returns 400 when startMs is missing', async () => {
    const res = await request(app).post('/cut/youtube').send({ youtubeUrl: TEST_URL, endMs: 10000 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when endMs is missing', async () => {
    const res = await request(app).post('/cut/youtube').send({ youtubeUrl: TEST_URL, startMs: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 200 with outputPath and durationMs on success', async () => {
    const res = await request(app).post('/cut/youtube').send({
      youtubeUrl: TEST_URL,
      startMs: 5000,
      endMs: 15000,
    });

    expect(res.status).toBe(200);
    expect(res.body.outputPath).toBe('/fake/output/yt_cut_123.mp4');
    expect(res.body.durationMs).toBe(10000);
  });

  it('forwards all optional fields to the service', async () => {
    await request(app).post('/cut/youtube').send({
      youtubeUrl: TEST_URL,
      startMs: 1000,
      endMs: 6000,
      outputDir: '/tmp/cuts',
      outputName: 'custom.mp4',
    });

    expect(cutYoutubeVideo).toHaveBeenCalledWith({
      youtubeUrl: TEST_URL,
      startMs: 1000,
      endMs: 6000,
      outputDir: '/tmp/cuts',
      outputName: 'custom.mp4',
    });
  });

  it('returns 500 with error message when service throws', async () => {
    vi.mocked(cutYoutubeVideo).mockRejectedValue(
      new Error('No suitable video format found for this video')
    );

    const res = await request(app).post('/cut/youtube').send({
      youtubeUrl: TEST_URL,
      startMs: 0,
      endMs: 5000,
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/no suitable video format/i);
  });

  it('returns 500 when ytdl cannot fetch video info', async () => {
    vi.mocked(cutYoutubeVideo).mockRejectedValue(
      new Error('Failed to get video info from YouTube')
    );

    const res = await request(app).post('/cut/youtube').send({
      youtubeUrl: TEST_URL,
      startMs: 0,
      endMs: 5000,
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/video info/i);
  });
});
