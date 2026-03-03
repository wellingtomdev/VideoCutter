import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import type { CutRequest, CutResponse, VideoInfo } from '@video-cutter/types';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe error: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const durationSec = metadata.format.duration ?? 0;

      resolve({
        path: videoPath,
        durationMs: Math.round(durationSec * 1000),
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
      });
    });
  });
}

export async function cutVideo(
  req: CutRequest,
  onProgress?: (percent: number) => void
): Promise<CutResponse> {
  if (req.startMs >= req.endMs) {
    throw new Error('startMs must be less than endMs');
  }

  const outputDir = req.outputDir;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startSec = req.startMs / 1000;
  const durationSec = (req.endMs - req.startMs) / 1000;

  const inputExt = path.extname(req.videoPath);
  const outputName = req.outputName ?? `cut_${Date.now()}${inputExt}`;
  const outputPath = path.join(outputDir, outputName);

  const offsetMs = req.audioOffsetMs ?? 0;

  return new Promise((resolve, reject) => {
    if (offsetMs === 0) {
      // Simple path: no audio offset, single input
      ffmpeg(req.videoPath)
        .setStartTime(startSec)
        .setDuration(durationSec)
        .outputOptions('-c copy')
        .output(outputPath)
        .on('progress', (info) => {
          if (onProgress && info.percent != null) {
            onProgress(Math.round(info.percent));
          }
        })
        .on('end', () => resolve({ outputPath, durationMs: req.endMs - req.startMs }))
        .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run();
    } else {
      // Audio offset path: two inputs from same file, -itsoffset on audio input
      const offsetSec = offsetMs / 1000;
      const cmd = ffmpeg();
      cmd.input(req.videoPath).inputOptions([`-ss ${startSec}`]);
      cmd.input(req.videoPath).inputOptions([`-itsoffset ${offsetSec}`, `-ss ${startSec}`]);
      cmd
        .outputOptions([`-t ${durationSec}`, '-map 0:v:0', '-map 1:a:0', '-c copy'])
        .output(outputPath)
        .on('progress', (info) => {
          if (onProgress && info.percent != null) onProgress(Math.round(info.percent));
        })
        .on('end', () => resolve({ outputPath, durationMs: req.endMs - req.startMs }))
        .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run();
    }
  });
}
