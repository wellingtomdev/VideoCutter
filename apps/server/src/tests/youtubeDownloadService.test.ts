/**
 * Unit tests for youtubeDownloadService.
 *
 * yt-dlp (youtube-dl-exec) and fluent-ffmpeg are fully mocked so no network
 * or disk I/O happens.  The mockYtdlExec implementation creates real but empty
 * temp files so findTempFile() succeeds, and the service's own finally-block
 * cleans them up automatically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os   from 'os';
import fs   from 'fs';
import path from 'path';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockYtdlExec, ffmpegFn, ffmpegChain, makeExecaProc } = vi.hoisted(() => {
  let endCb:   (() => void)        | null = null;
  let errorCb: ((e: Error) => void)| null = null;

  const chain: any = {
    input:         vi.fn().mockReturnThis(),
    seekInput:     vi.fn().mockReturnThis(),
    duration:      vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output:        vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation((event: string, cb: any) => {
      if (event === 'end')   endCb   = cb;
      if (event === 'error') errorCb = cb;
      return chain;
    }),
    run:        vi.fn().mockImplementation(() => setImmediate(() => endCb?.())),
    _fireError: (err: Error) => setImmediate(() => errorCb?.(err)),
    _reset:     () => { endCb = null; errorCb = null; },
  };

  const fn: any = vi.fn(() => chain);
  fn.setFfmpegPath  = vi.fn();
  fn.setFfprobePath = vi.fn();

  // mockYtdlExec creates a real (empty) .webm temp file so findTempFile() works.
  // Returns an execa-like object: thenable with a .stdout EventEmitter.
  // The file is cleaned up by the service's finally-block.
  const { EventEmitter } = require('events');

  /**
   * Create an execa-like child process mock: a thenable with .stdout EventEmitter.
   * If rejection is provided, the promise rejects with that error.
   */
  function makeExecaProc(opts?: { output?: string; reject?: Error }): any {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const promise = opts?.reject
      ? Promise.reject(opts.reject)
      : Promise.resolve();

    // Prevent unhandled rejection when used in Promise.all
    promise.catch(() => {});

    const proc = Object.assign(promise, { stdout, stderr });

    if (!opts?.reject && opts?.output) {
      // Emit fake ffmpeg progress lines on stderr (this is what yt-dlp
      // actually outputs when using --download-sections)
      setImmediate(() => {
        stderr.emit('data', Buffer.from('frame=  150 fps= 51 size=  256kB time=00:00:02.50 speed=1.66x\r\n'));
        stderr.emit('data', Buffer.from('frame=  301 fps= 57 size=  574kB time=00:00:05.00 speed=1.87x\r\n'));
        stdout.emit('data', Buffer.from('[download] 100% of  574.01KiB in 00:00:06 at 89.87KiB/s\n'));
      });
    }
    return proc;
  }

  const mockYtdlExec = vi.fn().mockImplementation((_url: string, opts: any) => {
    const tpl: string = opts.output;                       // e.g. /tmp/yt_xxx_v.%(ext)s
    const filePath = tpl.replace('.%(ext)s', '.webm');
    fs.writeFileSync(filePath, Buffer.alloc(0));           // create empty stub file
    return makeExecaProc({ output: tpl });
  });

  return { mockYtdlExec, ffmpegFn: fn, ffmpegChain: chain, makeExecaProc };
});

vi.mock('fluent-ffmpeg', () => ({ default: ffmpegFn }));
vi.mock('youtube-dl-exec', () => ({
  default: Object.assign(vi.fn(), { exec: mockYtdlExec }),
}));

// Import AFTER mocks
import { cutYoutubeVideo } from '../services/youtubeDownloadService';

// ── Constants ─────────────────────────────────────────────────────────────────

const YT_URL  = 'https://www.youtube.com/watch?v=86PGRyQjdzQ';
const OUT_DIR = os.tmpdir();

// ── Helpers ───────────────────────────────────────────────────────────────────

function restoreChain() {
  ffmpegChain.input.mockReturnThis();
  ffmpegChain.seekInput.mockReturnThis();
  ffmpegChain.duration.mockReturnThis();
  ffmpegChain.outputOptions.mockReturnThis();
  ffmpegChain.output.mockReturnThis();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cutYoutubeVideo — validation', () => {
  it('throws when startMs > endMs', async () => {
    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 10000, endMs: 5000, outputDir: OUT_DIR })
    ).rejects.toThrow('startMs must be less than endMs');
  });

  it('throws when startMs === endMs', async () => {
    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 5000, endMs: 5000, outputDir: OUT_DIR })
    ).rejects.toThrow('startMs must be less than endMs');
  });
});

describe('cutYoutubeVideo — yt-dlp invocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ffmpegChain._reset();
    restoreChain();
  });

  it('calls yt-dlp exec twice (video + audio streams)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    expect(mockYtdlExec).toHaveBeenCalledTimes(2);
  });

  it('passes the YouTube URL to both yt-dlp calls', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    for (const call of mockYtdlExec.mock.calls) {
      expect(call[0]).toBe(YT_URL);
    }
  });

  it('passes the correct --download-sections range (0–5 s)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    for (const call of mockYtdlExec.mock.calls) {
      expect(call[1].downloadSections).toBe('*0.000-5.000');
    }
  });

  it('passes the correct --download-sections range (30–35 s)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 30000, endMs: 35000, outputDir: OUT_DIR });
    for (const call of mockYtdlExec.mock.calls) {
      expect(call[1].downloadSections).toBe('*30.000-35.000');
    }
  });

  it('requests a video-only format for the first call', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    const videoCall = mockYtdlExec.mock.calls.find((c: any[]) =>
      (c[1].format as string).includes('bestvideo')
    );
    expect(videoCall).toBeDefined();
  });

  it('requests an audio-only format for the second call', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    const audioCall = mockYtdlExec.mock.calls.find((c: any[]) =>
      (c[1].format as string).includes('bestaudio')
    );
    expect(audioCall).toBeDefined();
  });

  it('disables playlist downloads (--no-playlist)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    for (const call of mockYtdlExec.mock.calls) {
      expect(call[1].noPlaylist).toBe(true);
    }
  });
});

describe('cutYoutubeVideo — ffmpeg merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ffmpegChain._reset();
    restoreChain();
  });

  it('passes two inputs to ffmpeg (video then audio)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    expect(ffmpegChain.input).toHaveBeenCalledTimes(2);
    // Both inputs should be file paths (strings ending in .webm from mock)
    const [firstArg]  = ffmpegChain.input.mock.calls[0];
    const [secondArg] = ffmpegChain.input.mock.calls[1];
    expect(typeof firstArg).toBe('string');
    expect(typeof secondArg).toBe('string');
  });

  it('does NOT seek within temp files (yt-dlp re-indexes timestamps to 0)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 30000, endMs: 35000, outputDir: OUT_DIR });
    expect(ffmpegChain.seekInput).not.toHaveBeenCalled();
  });

  it('output options include stream copy and correct stream mapping', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 10000, outputDir: OUT_DIR });
    const opts = ffmpegChain.outputOptions.mock.calls.flat(2) as string[];
    expect(opts).toContain('-c:v copy');
    expect(opts).toContain('-c:a copy');
    expect(opts).toContain('-map 0:v:0');
    expect(opts).toContain('-map 1:a:0');
  });

  it('output options include -t (duration)', async () => {
    await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 7000, outputDir: OUT_DIR });
    const opts = ffmpegChain.outputOptions.mock.calls.flat(2) as string[];
    expect(opts).toContain('-t 7');
  });

  it('returns correct durationMs', async () => {
    const result = await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 5000, endMs: 15000, outputDir: OUT_DIR });
    expect(result.durationMs).toBe(10000);
  });

  it('returns an .mp4 outputPath by default', async () => {
    const result = await cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR });
    expect(result.outputPath).toMatch(/\.mp4$/);
  });

  it('uses custom outputName when provided', async () => {
    const result = await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR, outputName: 'my_clip.mp4',
    });
    expect(result.outputPath).toMatch(/my_clip\.mp4$/);
  });
});

describe('cutYoutubeVideo — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ffmpegChain._reset();
    restoreChain();
  });

  it('wraps yt-dlp errors with context message', async () => {
    // All yt-dlp calls must fail (separate streams + muxed fallback)
    const err = new Error('Unable to extract video data');
    mockYtdlExec
      .mockImplementationOnce(() => makeExecaProc({ reject: err }))
      .mockImplementationOnce(() => makeExecaProc({ reject: err }))
      .mockImplementationOnce(() => makeExecaProc({ reject: err }));
    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR })
    ).rejects.toThrow('YouTube cut failed');
  });

  it('wraps ffmpeg errors with context message', async () => {
    ffmpegChain.run.mockImplementationOnce(() =>
      ffmpegChain._fireError(new Error('ffmpeg exited with code 1'))
    );
    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR })
    ).rejects.toThrow('FFmpeg error');
  });

  it('cleans up temp files even when ffmpeg errors', async () => {
    const createdFiles: string[] = [];
    mockYtdlExec.mockImplementation((_url: string, opts: any) => {
      const filePath = (opts.output as string).replace('.%(ext)s', '.webm');
      fs.writeFileSync(filePath, Buffer.alloc(0));
      createdFiles.push(filePath);
      return makeExecaProc({ output: opts.output });
    });
    ffmpegChain.run.mockImplementationOnce(() =>
      ffmpegChain._fireError(new Error('ffmpeg exited with code 1'))
    );

    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR })
    ).rejects.toThrow();

    // Temp files must be deleted by the service's finally-block
    for (const f of createdFiles) {
      expect(fs.existsSync(f)).toBe(false);
    }
  });
});

describe('cutYoutubeVideo — onProgress callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ffmpegChain._reset();
    restoreChain();
  });

  it('calls onProgress with downloading and merging phases on success', async () => {
    const onProgress = vi.fn();
    await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR, onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith('downloading', expect.any(Number), expect.any(String));
    expect(onProgress).toHaveBeenCalledWith('merging', expect.any(Number), expect.any(String));
    expect(onProgress).toHaveBeenCalledWith('done', 100, expect.any(String));
  });

  it('reports downloading phase before merging phase', async () => {
    const phases: string[] = [];
    await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR,
      onProgress: (phase) => phases.push(phase),
    });

    const dlIdx = phases.indexOf('downloading');
    const mergeIdx = phases.indexOf('merging');
    const doneIdx = phases.indexOf('done');

    expect(dlIdx).toBeLessThan(mergeIdx);
    expect(mergeIdx).toBeLessThan(doneIdx);
  });

  it('progress starts low, ends at 100, and generally increases', async () => {
    const progresses: number[] = [];
    await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR,
      onProgress: (_, progress) => progresses.push(progress),
    });

    // First progress should be low (< 20%)
    expect(progresses[0]).toBeLessThan(20);
    // Last progress should be 100
    expect(progresses[progresses.length - 1]).toBe(100);
    // Should have multiple progress updates
    expect(progresses.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onProgress with fallback flow when separate streams fail', async () => {
    // Make separate stream downloads fail, muxed fallback succeeds
    const err = new Error('No separate streams');
    mockYtdlExec
      .mockImplementationOnce(() => makeExecaProc({ reject: err }))
      .mockImplementationOnce(() => makeExecaProc({ reject: err }))
      .mockImplementationOnce((_url: string, opts: any) => {
        const filePath = (opts.output as string).replace('.%(ext)s', '.webm');
        fs.writeFileSync(filePath, Buffer.alloc(0));
        return makeExecaProc({ output: opts.output });
      });

    const phases: string[] = [];
    await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR,
      onProgress: (phase) => phases.push(phase),
    });

    expect(phases).toContain('downloading');
    expect(phases).toContain('merging');
    expect(phases).toContain('done');
  });

  it('reports real download percentages with size and speed from ffmpeg stderr', async () => {
    const messages: string[] = [];
    await cutYoutubeVideo({
      youtubeUrl: YT_URL, startMs: 0, endMs: 5000,
      outputDir: OUT_DIR,
      onProgress: (_phase, _progress, message) => messages.push(message),
    });

    // The mock emits ffmpeg progress lines: "time=00:00:02.50 size=256kB speed=1.66x"
    // Messages should contain video/audio percentages
    const detailMsgs = messages.filter(m =>
      (m.includes('Vídeo') || m.includes('Áudio')) && /\d+%/.test(m),
    );
    expect(detailMsgs.length).toBeGreaterThan(0);

    // At least one message should include size or speed from ffmpeg output
    const withDetails = detailMsgs.filter(m => m.includes('kB') || m.includes('x') || m.includes('s /'));
    expect(withDetails.length).toBeGreaterThan(0);
  });

  it('works fine without onProgress callback (backward compat)', async () => {
    await expect(
      cutYoutubeVideo({ youtubeUrl: YT_URL, startMs: 0, endMs: 5000, outputDir: OUT_DIR }),
    ).resolves.toHaveProperty('outputPath');
  });
});
