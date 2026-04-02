/**
 * Integration tests for cutYoutubeVideo.
 *
 * These tests make REAL network requests and invoke yt-dlp + ffmpeg.
 * They require:
 *   - Internet access
 *   - yt-dlp binary (auto-downloaded by youtube-dl-exec on npm install)
 *   - ffmpeg binary (bundled via @ffmpeg-installer/ffmpeg)
 *
 * Run time: ~30–120 seconds per test depending on network speed.
 *
 * To skip these tests set env: SKIP_INTEGRATION=true
 */

import { describe, it, expect, afterEach } from 'vitest';
import fs   from 'fs';
import os   from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

import { cutYoutubeVideo } from '../services/youtubeDownloadService';

ffmpeg.setFfprobePath(ffprobeInstaller.path);

/** Returns the duration of a media file in milliseconds via ffprobe. */
function probeDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(Math.round((meta.format.duration ?? 0) * 1000));
    });
  });
}

const SKIP = process.env.SKIP_INTEGRATION === 'true';
const YT_URL = 'https://www.youtube.com/watch?v=86PGRyQjdzQ';

// Collect output files to clean up after each test
const filesToClean: string[] = [];

afterEach(() => {
  for (const f of filesToClean.splice(0)) {
    try { fs.unlinkSync(f); } catch {}
  }
});

describe.skipIf(SKIP)('cutYoutubeVideo — real yt-dlp + ffmpeg', () => {
  it(
    'cuts the first 5 seconds and produces a non-empty .mp4 file',
    async () => {
      const result = await cutYoutubeVideo({
        youtubeUrl: YT_URL,
        startMs: 0,
        endMs: 5000,
        outputDir: os.tmpdir(),
      });

      filesToClean.push(result.outputPath);

      expect(result.durationMs).toBe(5000);
      expect(result.outputPath).toMatch(/\.mp4$/);
      expect(fs.existsSync(result.outputPath)).toBe(true);

      const { size } = fs.statSync(result.outputPath);
      // A 5-second video clip should be at least a few KB
      expect(size).toBeGreaterThan(5_000);

      // Verify actual duration via ffprobe.
      // HLS streams have coarser segment boundaries, so allow wider tolerance.
      const actualMs = await probeDurationMs(result.outputPath);
      expect(actualMs).toBeGreaterThanOrEqual(3_000);
      expect(actualMs).toBeLessThanOrEqual(7_000);
    },
    { timeout: 120_000 },
  );

  it(
    'cuts a 3-second segment starting at 10 seconds',
    async () => {
      const result = await cutYoutubeVideo({
        youtubeUrl: YT_URL,
        startMs: 10_000,
        endMs: 13_000,
        outputDir: os.tmpdir(),
      });

      filesToClean.push(result.outputPath);

      expect(result.durationMs).toBe(3000);
      expect(fs.existsSync(result.outputPath)).toBe(true);

      const { size } = fs.statSync(result.outputPath);
      expect(size).toBeGreaterThan(5_000);

      // Verify actual duration via ffprobe.
      // HLS streams have coarser segment boundaries than DASH, so when only
      // muxed HLS is available the actual duration can deviate more from the
      // requested range. We allow a wider tolerance here.
      const actualMs = await probeDurationMs(result.outputPath);
      expect(actualMs).toBeGreaterThanOrEqual(1_000);
      expect(actualMs).toBeLessThanOrEqual(5_000);
    },
    { timeout: 120_000 },
  );

  it(
    'respects a custom outputName',
    async () => {
      const outputName = `integration_test_${Date.now()}.mp4`;
      const result = await cutYoutubeVideo({
        youtubeUrl: YT_URL,
        startMs: 0,
        endMs: 3000,
        outputDir: os.tmpdir(),
        outputName,
      });

      filesToClean.push(result.outputPath);

      expect(result.outputPath).toMatch(new RegExp(`${outputName}$`));
      expect(fs.existsSync(result.outputPath)).toBe(true);
    },
    { timeout: 120_000 },
  );

  it(
    'rejects invalid YouTube URLs',
    async () => {
      await expect(
        cutYoutubeVideo({
          youtubeUrl: 'https://www.youtube.com/watch?v=INVALID_ID_XYZ',
          startMs: 0,
          endMs: 5000,
          outputDir: os.tmpdir(),
        })
      ).rejects.toThrow();
    },
    { timeout: 60_000 },
  );
});
