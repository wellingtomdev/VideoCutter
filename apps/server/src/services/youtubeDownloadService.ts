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
 * Invoke yt-dlp to download one stream (video-only or audio-only) for the
 * given time section to a temp file.
 */
export async function downloadStream(
  url: string,
  format: string,
  outputBase: string,
  section: string,
): Promise<void> {
  const ffmpegDir = path.dirname(ffmpegInstaller.path);
  await (youtubedl as any).exec(url, {
    format,
    output: `${outputBase}.%(ext)s`,
    downloadSections: section,
    noPlaylist: true,
    noWarnings: true,
    // Tell yt-dlp where to find ffmpeg (needed for post-processing / muxing)
    ffmpegLocation: ffmpegDir,
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function cutYoutubeVideo({
  youtubeUrl,
  startMs,
  endMs,
  outputDir,
  outputName,
  audioOffsetMs,
}: {
  youtubeUrl: string;
  startMs: number;
  endMs: number;
  outputDir?: string;
  outputName?: string;
  audioOffsetMs?: number;
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

  try {
    // Download best video-only and audio-only streams in parallel.
    // YouTube serves HD video (1080p+) as separate DASH streams; yt-dlp picks
    // the best available for each and downloads only the requested section.
    await Promise.all([
      downloadStream(
        youtubeUrl,
        'bestvideo[vcodec^=avc1]/bestvideo[ext=webm]/bestvideo',
        videoBase,
        section,
      ),
      downloadStream(
        youtubeUrl,
        'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
        audioBase,
        section,
      ),
    ]);

    const videoFile = findTempFile(videoBase);
    const audioFile = findTempFile(audioBase);

    // Merge video + audio with ffmpeg.
    // NOTE: yt-dlp uses its own internal ffmpeg call for --download-sections and
    // re-indexes the output timestamps to start at 0. We must NOT seek again;
    // the downloaded files already start near the requested position.
    // We just apply -t durationSec to cap the output at the correct duration.
    return await mergeStreams(
      videoFile,
      audioFile,
      durationSec,
      outputPath,
      endMs - startMs,
      audioOffsetMs ?? 0,
    );
  } catch (err: any) {
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch {}
    }
    throw new Error(`YouTube cut failed: ${err?.message ?? err}`);
  } finally {
    // Clean up temp files (video and audio bases)
    const tmpDir = os.tmpdir();
    for (const base of [path.basename(videoBase), path.basename(audioBase)]) {
      try {
        const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith(base + '.'));
        for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
      } catch {}
    }
  }
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
