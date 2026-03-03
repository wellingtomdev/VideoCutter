import { describe, it, expect } from 'vitest';
import { cutVideo } from '../services/ffmpegService';
import type { CutRequest } from '@video-cutter/types';

describe('cutVideo', () => {
  it('rejects when startMs >= endMs', async () => {
    const req: CutRequest = {
      videoPath: '/fake/video.mp4',
      outputDir: '/tmp',
      startMs: 5000,
      endMs: 3000,
    };
    await expect(cutVideo(req)).rejects.toThrow('startMs must be less than endMs');
  });

  it('rejects when startMs equals endMs', async () => {
    const req: CutRequest = {
      videoPath: '/fake/video.mp4',
      outputDir: '/tmp',
      startMs: 5000,
      endMs: 5000,
    };
    await expect(cutVideo(req)).rejects.toThrow('startMs must be less than endMs');
  });
});
