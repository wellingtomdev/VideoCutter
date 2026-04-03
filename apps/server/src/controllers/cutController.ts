import type { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpegLib from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { cutVideo } from '../services/ffmpegService';
import { cutYoutubeVideo } from '../services/youtubeDownloadService';
import { updateJob, getJob, getJobDir } from '../services/jobStore';
import { setProgress, getProgress, setLastPreparedPath, getLastPreparedPath, setPrepareProgress, subscribePrepareProgress, clearPrepareProgress } from '../services/progressStore';
import { formatMsToTime, formatMsToFilename } from '../utils/format';
import { ensureDir, safeUnlink } from '../utils/fs';
import { config } from '../config';
import type { CutRequest } from '@video-cutter/types';

ffmpegLib.setFfmpegPath(ffmpegInstaller.path);

export async function handleCut(req: Request, res: Response): Promise<void> {
  const body = req.body as CutRequest;

  if (!body.videoPath || body.startMs == null || body.endMs == null) {
    res.status(400).json({ error: 'Missing required fields: videoPath, startMs, endMs' });
    return;
  }

  if (body.startMs >= body.endMs) {
    res.status(400).json({ error: 'startMs must be less than endMs' });
    return;
  }

  const jobId = Date.now().toString();
  setProgress(jobId, { progress: 0, done: false });

  try {
    const result = await cutVideo(body, (progress) => {
      setProgress(jobId, { progress, done: false });
    });

    setProgress(jobId, { progress: 100, done: true, outputPath: result.outputPath });
    res.json({ ...result, jobId });
  } catch (err) {
    setProgress(jobId, { progress: 0, done: true, error: String(err) });
    res.status(500).json({ error: String(err) });
  }
}

export async function handleCutYoutube(req: Request, res: Response): Promise<void> {
  const { youtubeUrl, startMs, endMs, outputDir, outputName, audioOffsetMs } = req.body as {
    youtubeUrl?: string;
    startMs?: number;
    endMs?: number;
    outputDir?: string;
    outputName?: string;
    audioOffsetMs?: number;
  };

  if (!youtubeUrl || startMs == null || endMs == null) {
    res.status(400).json({ error: 'Missing required fields: youtubeUrl, startMs, endMs' });
    return;
  }

  try {
    const result = await cutYoutubeVideo({ youtubeUrl, startMs, endMs, outputDir, outputName, audioOffsetMs });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handlePrepare(req: Request, res: Response): Promise<void> {
  const { videoPath, youtubeUrl, startMs, endMs, jobId } = req.body as {
    videoPath?: string;
    youtubeUrl?: string;
    startMs?: number;
    endMs?: number;
    jobId?: string;
  };

  if (startMs == null || endMs == null) {
    res.status(400).json({ error: 'Missing required fields: startMs, endMs' });
    return;
  }
  if (!videoPath && !youtubeUrl) {
    res.status(400).json({ error: 'Missing videoPath or youtubeUrl' });
    return;
  }

  const actualStart = Math.max(0, startMs - config.paddingMs);
  const paddingBeforeMs = startMs - actualStart;
  const actualEnd = endMs + config.paddingMs;
  const paddingAfterMs = config.paddingMs;
  const originalDurationMs = endMs - startMs;

  const outputName = `prepared_${Date.now()}.mp4`;

  const outputDir = jobId ? getJobDir(jobId) : os.tmpdir();
  ensureDir(outputDir);

  // Clean up previous non-job prepared file
  if (!jobId && getLastPreparedPath()) {
    safeUnlink(getLastPreparedPath()!);
    setLastPreparedPath(null);
  }

  // Clean up ALL orphaned prepared files inside the job folder
  if (jobId) {
    try {
      const jobDir = getJobDir(jobId);
      if (fs.existsSync(jobDir)) {
        const files = fs.readdirSync(jobDir);
        for (const f of files) {
          if (f.startsWith('prepared_') && f.endsWith('.mp4')) {
            safeUnlink(path.join(jobDir, f));
          }
        }
      }
    } catch {}
  }

  if (jobId) {
    try { await updateJob(jobId, { status: 'preparing', cut: { startMs, endMs, audioOffsetMs: 0 } }); } catch {}
  }

  try {
    let result: { outputPath: string };

    if (youtubeUrl) {
      const progressJobId = jobId ?? `prepare_${Date.now()}`;
      setPrepareProgress(progressJobId, { phase: 'downloading', progress: 0, message: 'Iniciando download...', done: false });

      result = await cutYoutubeVideo({
        youtubeUrl,
        startMs: actualStart,
        endMs: actualEnd,
        outputDir,
        outputName,
        onProgress: (phase, progress, message) => {
          setPrepareProgress(progressJobId, { phase, progress, message, done: phase === 'done' });
        },
      });

      clearPrepareProgress(progressJobId);
    } else {
      result = await cutVideo({
        videoPath: videoPath!,
        outputDir,
        startMs: actualStart,
        endMs: actualEnd,
        outputName,
      });
    }

    if (!jobId) {
      setLastPreparedPath(result.outputPath);
    }

    const prepareResult = {
      filePath: result.outputPath,
      paddingBeforeMs,
      paddingAfterMs,
      originalDurationMs,
    };

    if (jobId) {
      try { await updateJob(jobId, { prepare: prepareResult }); } catch {}
    }

    res.json(prepareResult);
  } catch (err) {
    if (jobId) {
      try { await updateJob(jobId, { status: 'error', error: err instanceof Error ? err.message : String(err) }); } catch {}
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleFinalize(req: Request, res: Response): Promise<void> {
  const { sourcePath, trimStartMs, trimDurationMs, audioOffsetMs, outputDir, outputName, jobId } = req.body as {
    sourcePath?: string;
    trimStartMs?: number;
    trimDurationMs?: number;
    audioOffsetMs?: number;
    outputDir?: string;
    outputName?: string;
    jobId?: string;
  };

  if (!sourcePath || trimStartMs == null || trimDurationMs == null) {
    res.status(400).json({ error: 'Missing required fields: sourcePath, trimStartMs, trimDurationMs' });
    return;
  }

  if (!fs.existsSync(sourcePath)) {
    res.status(404).json({ error: 'Source file not found (may have been cleaned up)' });
    return;
  }

  const dir = jobId ? getJobDir(jobId) : (outputDir || path.join(os.homedir(), 'Downloads'));
  ensureDir(dir);

  let name = outputName ?? `clip_${Date.now()}.mp4`;
  // Generate time-based name when tied to a job
  if (!outputName && jobId) {
    try {
      const currentJobForName = await getJob(jobId);
      const s = currentJobForName.cut?.startMs ?? 0;
      const e = currentJobForName.cut?.endMs ?? trimDurationMs;
      name = `clip_${formatMsToFilename(s)}-${formatMsToFilename(e)}.mp4`;
      // Append suffix if file already exists (re-export)
      let outputCheck = path.join(dir, name);
      let suffix = 1;
      while (fs.existsSync(outputCheck)) {
        name = `clip_${formatMsToFilename(s)}-${formatMsToFilename(e)}_${suffix}.mp4`;
        outputCheck = path.join(dir, name);
        suffix++;
      }
    } catch {}
  }
  const outputPath = path.join(dir, name);
  const offsetMs = audioOffsetMs ?? 0;
  const trimStartSec = trimStartMs / 1000;
  const trimDurationSec = trimDurationMs / 1000;

  try {
    await new Promise<void>((resolve, reject) => {
      if (offsetMs === 0) {
        ffmpegLib(sourcePath)
          .setStartTime(trimStartSec)
          .setDuration(trimDurationSec)
          .outputOptions('-c copy')
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
          .run();
      } else {
        const offsetSec = offsetMs / 1000;
        const cmd = ffmpegLib();
        cmd.input(sourcePath).inputOptions([`-ss ${trimStartSec}`]);
        cmd.input(sourcePath).inputOptions([`-itsoffset ${offsetSec}`, `-ss ${trimStartSec}`]);
        cmd
          .outputOptions([`-t ${trimDurationSec}`, '-map 0:v:0', '-map 1:a:0', '-c copy'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
          .run();
      }
    });

    if (jobId) {
      const fileSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : undefined;
      const outputData = { filePath: outputPath, durationMs: trimDurationMs, fileSize };

      const currentJob = await getJob(jobId);
      const cutStartMs = currentJob.cut?.startMs ?? 0;
      const cutEndMs = currentJob.cut?.endMs ?? trimDurationMs;
      const label = `${formatMsToTime(cutStartMs)} → ${formatMsToTime(cutEndMs)}`;

      await updateJob(jobId, {
        status: 'ready',
        output: outputData,
        prepare: null,
        newCutEntry: {
          label,
          startMs: cutStartMs,
          endMs: cutEndMs,
          audioOffsetMs: offsetMs,
          output: outputData,
        },
      });
    }

    // Clean up the prepared temp file only after job metadata is saved
    safeUnlink(sourcePath);
    if (getLastPreparedPath() === sourcePath) setLastPreparedPath(null);

    res.json({ outputPath, durationMs: trimDurationMs });
  } catch (err) {
    if (jobId) {
      try { await updateJob(jobId, { status: 'error', error: err instanceof Error ? err.message : String(err) }); } catch {}
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export function handleProgress(req: Request, res: Response): void {
  const job = getProgress(req.params.jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify(job)}\n\n`);
  res.end();
}

export function handlePrepareProgress(req: Request, res: Response): void {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let ended = false;
  let unsubscribe: (() => void) | null = null;

  unsubscribe = subscribePrepareProgress(jobId, (data) => {
    if (ended) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.done || data.phase === 'error') {
      ended = true;
      unsubscribe?.();
      res.end();
    }
  });

  req.on('close', () => {
    ended = true;
    unsubscribe?.();
  });
}
