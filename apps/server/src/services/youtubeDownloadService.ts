/**
 * YouTube video cutting service using yt-dlp + ffmpeg.
 *
 * Strategy:
 *  1. yt-dlp downloads the best video-only and audio-only DASH streams to temp
 *     files, restricted to the requested time range via --download-sections so
 *     we only fetch what's needed.
 *  2. ffmpeg merges the two temp files and cuts to the exact [startMs, endMs]
 *     range with stream copy (no re-encode).
 *
 * Why yt-dlp instead of @distube/ytdl-core:
 *  - ytdl-core is increasingly blocked by YouTube bot-detection.
 *  - yt-dlp is constantly maintained to bypass those measures and supports
 *    --download-sections to avoid downloading entire videos.
 */

import youtubedl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import fs from 'fs';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultOutputDir(): string {
  const downloads = path.join(os.homedir(), 'Downloads');
  return fs.existsSync(downloads) ? downloads : os.homedir();
}

function makeTmpBase(): string {
  return path.join(
    os.tmpdir(),
    `yt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
}

/**
 * Find the actual temp file created by yt-dlp.
 * yt-dlp uses %(ext)s in the output template, so we search for known extensions.
 */
export function findTempFile(base: string): string {
  for (const ext of ['webm', 'mp4', 'm4a', 'mkv', 'ogg', 'opus', 'mp3']) {
    const candidate = `${base}.${ext}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No temp file found for ${base}.* — yt-dlp may have failed silently`);
}

/**
 * Progress info from yt-dlp / ffmpeg output.
 *
 * With --download-sections, yt-dlp uses ffmpeg internally to cut streams.
 * There are NO intermediate [download] XX% lines — only ffmpeg progress on
 * stderr like: "frame= 298 fps= 56 size= 512kB time=00:00:09.87 speed=1.85x"
 *
 * We parse both formats so it works regardless of yt-dlp's download mode.
 */
export interface DownloadInfo {
  percent: number;
  size?: string;    // e.g. "512kB", "~120.50MiB"
  speed?: string;   // e.g. "1.85x", "2.50MiB/s"
  time?: string;    // e.g. "00:00:09.87"
}

/** Parse yt-dlp "[download] XX%" line (used when NOT using --download-sections) */
function parseYtdlpDownloadLine(line: string): DownloadInfo | null {
  const pctMatch = line.match(/\[download\]\s+([\d.]+)%/);
  if (!pctMatch) return null;

  const percent = parseFloat(pctMatch[1]);
  const sizeMatch = line.match(/of\s+(~?[\d.]+\w+)/);
  const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);

  return { percent, size: sizeMatch?.[1], speed: speedMatch?.[1] };
}

/**
 * Parse ffmpeg progress line from stderr.
 * Example: "frame= 298 fps= 56 size= 512kB time=00:00:09.87 speed=1.85x"
 * Returns the time in seconds, size, and speed.
 */
function parseFfmpegProgress(line: string): { timeSec: number; size?: string; speed?: string } | null {
  const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!timeMatch) return null;

  const [, h, m, s, cs] = timeMatch;
  const timeSec = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(cs) / 100;

  const sizeMatch = line.match(/size=\s*([\d.]+\w+)/);
  const speedMatch = line.match(/speed=\s*([\d.]+x)/);

  return { timeSec, size: sizeMatch?.[1], speed: speedMatch?.[1] };
}

export type DownloadProgressCallback = (info: DownloadInfo) => void;

/**
 * Invoke yt-dlp to download one stream (video-only or audio-only) for the
 * given time section to a temp file.
 */
export async function downloadStream(
  url: string,
  format: string,
  outputBase: string,
  section: string,
  onDownloadProgress?: DownloadProgressCallback,
  durationSec?: number,
): Promise<void> {
  const ffmpegDir = path.dirname(ffmpegInstaller.path);
  const proc = (youtubedl as any).exec(url, {
    format,
    output: `${outputBase}.%(ext)s`,
    downloadSections: section,
    noPlaylist: true,
    noWarnings: true,
    // Tell yt-dlp where to find ffmpeg (needed for post-processing / muxing)
    ffmpegLocation: ffmpegDir,
    // Node.js runtime needed for YouTube JS challenge solving
    jsRuntimes: 'node',
    // Force progress output even when not a TTY, use newlines instead of \r
    progress: true,
    newline: true,
  });

  if (onDownloadProgress) {
    const handleChunk = (chunk: Buffer) => {
      const lines = chunk.toString().split(/[\r\n]+/);
      for (const line of lines) {
        // Try yt-dlp [download] format first (normal downloads)
        const dlInfo = parseYtdlpDownloadLine(line);
        if (dlInfo) { onDownloadProgress(dlInfo); continue; }

        // Try ffmpeg progress format (used with --download-sections)
        const ffInfo = parseFfmpegProgress(line);
        if (ffInfo && durationSec && durationSec > 0) {
          const percent = Math.min(100, (ffInfo.timeSec / durationSec) * 100);
          onDownloadProgress({
            percent,
            size: ffInfo.size,
            speed: ffInfo.speed,
            time: `${Math.round(ffInfo.timeSec)}s / ${Math.round(durationSec)}s`,
          });
        }
      }
    };
    // ffmpeg progress goes to stderr; yt-dlp download lines go to stdout
    if (proc.stdout) proc.stdout.on('data', handleChunk);
    if (proc.stderr) proc.stderr.on('data', handleChunk);
  }

  await proc;
}

// ── Main export ───────────────────────────────────────────────────────────────

export type ProgressCallback = (phase: 'downloading' | 'merging' | 'done' | 'error', progress: number, message: string) => void;

export async function cutYoutubeVideo({
  youtubeUrl,
  startMs,
  endMs,
  outputDir,
  outputName,
  audioOffsetMs,
  onProgress,
}: {
  youtubeUrl: string;
  startMs: number;
  endMs: number;
  outputDir?: string;
  outputName?: string;
  audioOffsetMs?: number;
  onProgress?: ProgressCallback;
}): Promise<{ outputPath: string; durationMs: number }> {
  if (startMs >= endMs) throw new Error('startMs must be less than endMs');

  const dir = outputDir || defaultOutputDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const name = outputName ?? `yt_cut_${Date.now()}.mp4`;
  const outputPath = path.join(dir, name);

  const startSec = startMs / 1000;
  const endSec   = endMs   / 1000;
  const durationSec = endSec - startSec;

  // yt-dlp --download-sections format: "*START-END" (seconds, 3 decimal places)
  const section = `*${startSec.toFixed(3)}-${endSec.toFixed(3)}`;

  const videoBase = makeTmpBase() + '_v';
  const audioBase = makeTmpBase() + '_a';
  const muxedBase = makeTmpBase() + '_muxed';

  try {
    // Try downloading separate video + audio streams (best quality).
    // YouTube may not serve separate DASH streams due to bot-detection,
    // in which case we fall back to a single muxed stream.
    let useMuxedFallback = false;

    // Track download progress for video and audio streams independently.
    // Combined progress = average of both, mapped to 5–55% range.
    let videoInfo: DownloadInfo = { percent: 0 };
    let audioInfo: DownloadInfo = { percent: 0 };
    const reportDownloadProgress = () => {
      const avg = (videoInfo.percent + audioInfo.percent) / 2;
      const mapped = Math.round(5 + avg * 0.5); // 5–55%

      // Build detailed message with speed/ETA from the stream that's still downloading
      const active = videoInfo.percent < 100 ? videoInfo : audioInfo;
      const parts: string[] = [
        `Vídeo ${Math.round(videoInfo.percent)}%`,
        `Áudio ${Math.round(audioInfo.percent)}%`,
      ];
      const detail: string[] = [];
      if (active.size) detail.push(active.size);
      if (active.speed) detail.push(active.speed);
      if (active.eta) detail.push(`ETA ${active.eta}`);

      const msg = detail.length > 0
        ? `${parts.join(' · ')}  —  ${detail.join(' · ')}`
        : parts.join(' · ');

      onProgress?.('downloading', mapped, msg);
    };

    onProgress?.('downloading', 5, 'Iniciando download...');

    try {
      await Promise.all([
        downloadStream(
          youtubeUrl,
          'bestvideo[vcodec^=avc1]/bestvideo[ext=webm]/bestvideo',
          videoBase,
          section,
          (info) => { videoInfo = info; reportDownloadProgress(); },
          durationSec,
        ),
        downloadStream(
          youtubeUrl,
          'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
          audioBase,
          section,
          (info) => { audioInfo = info; reportDownloadProgress(); },
          durationSec,
        ),
      ]);
      // Verify both files were created
      findTempFile(videoBase);
      findTempFile(audioBase);
    } catch {
      useMuxedFallback = true;
    }

    if (useMuxedFallback) {
      onProgress?.('downloading', 10, 'Baixando stream muxado (fallback)...');
      // Fallback: download best muxed stream (video+audio together).
      // Format selector uses * to include muxed formats.
      await downloadStream(
        youtubeUrl,
        'bestvideo*+bestaudio*/best',
        muxedBase,
        section,
        (info) => {
          const mapped = Math.round(5 + info.percent * 0.55); // 5–60%
          const detail: string[] = [`${Math.round(info.percent)}%`];
          if (info.size) detail.push(info.size);
          if (info.speed) detail.push(info.speed);
          if (info.eta) detail.push(`ETA ${info.eta}`);
          onProgress?.('downloading', mapped, `Baixando: ${detail.join(' · ')}`);
        },
        durationSec,
      );

      onProgress?.('merging', 70, 'Processando vídeo...');
      const muxedFile = findTempFile(muxedBase);
      const result = await trimSingle(muxedFile, durationSec, outputPath, endMs - startMs);
      onProgress?.('done', 100, 'Concluído!');
      return result;
    }

    onProgress?.('merging', 60, 'Mesclando streams de vídeo e áudio...');

    const videoFile = findTempFile(videoBase);
    const audioFile = findTempFile(audioBase);

    // Merge video + audio with ffmpeg.
    // NOTE: yt-dlp re-indexes timestamps to 0. We just apply -t to cap duration.
    const result = await mergeStreams(
      videoFile,
      audioFile,
      durationSec,
      outputPath,
      endMs - startMs,
      audioOffsetMs ?? 0,
    );
    onProgress?.('done', 100, 'Concluído!');
    return result;
  } catch (err: any) {
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch {}
    }
    throw new Error(`YouTube cut failed: ${err?.message ?? err}`);
  } finally {
    // Clean up temp files
    const tmpDir = os.tmpdir();
    for (const base of [path.basename(videoBase), path.basename(audioBase), path.basename(muxedBase)]) {
      try {
        const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith(base + '.'));
        for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
      } catch {}
    }
  }
}

// ── ffmpeg trim (single muxed file) ──────────────────────────────────────────

/**
 * Trim a single muxed file to the exact duration.
 * Used when yt-dlp downloaded a muxed stream (video+audio together).
 */
function trimSingle(
  inputPath: string,
  durationSec: number,
  outputPath: string,
  durationMs: number,
): Promise<{ outputPath: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .outputOptions([
        `-t ${durationSec}`,
        '-c:v copy',
        '-c:a copy',
      ])
      .output(outputPath)
      .on('end',   ()    => resolve({ outputPath, durationMs }))
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .run();
  });
}

// ── ffmpeg merge ──────────────────────────────────────────────────────────────

/**
 * Merge video-only and audio-only temp files into one MP4.
 *
 * We do NOT seek (-ss) inside the temp files because yt-dlp's internal ffmpeg
 * already re-indexed their timestamps to start at 0. Seeking to the original
 * video timestamp would jump past the content, producing a near-empty clip.
 * The -t flag is enough to cap the output at exactly durationSec.
 */
function mergeStreams(
  videoPath: string,
  audioPath: string,
  durationSec: number,
  outputPath: string,
  durationMs: number,
  audioOffsetMs: number,
): Promise<{ outputPath: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    cmd.input(videoPath);

    if (audioOffsetMs !== 0) {
      cmd.input(audioPath).inputOptions([`-itsoffset ${audioOffsetMs / 1000}`]);
    } else {
      cmd.input(audioPath);
    }

    cmd
      .outputOptions([
        `-t ${durationSec}`,
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v copy',
        '-c:a copy',
      ])
      .output(outputPath)
      .on('end',   ()    => resolve({ outputPath, durationMs }))
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .run();
  });
}
