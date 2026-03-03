import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fetchTranscript } from 'youtube-transcript-plus';
import { getVideoInfo } from '../services/ffmpegService';
import { parseTranscript, parseTranscriptAuto } from '../services/transcriptParser';
import { extractYoutubeId, decodeHtmlEntities } from '../utils/youtube';
import type { TranscriptSegment } from '@video-cutter/types';

export async function handleYoutubeTranscript(req: Request, res: Response): Promise<void> {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  const videoId = extractYoutubeId(url);
  if (!videoId) {
    res.status(400).json({ error: 'Could not extract video ID from URL' });
    return;
  }

  try {
    const raw = await fetchTranscript(videoId);
    const segments: TranscriptSegment[] = raw.map((item, i) => ({
      id: i,
      startMs: Math.round(item.offset * 1000),
      endMs: Math.round((item.offset + item.duration) * 1000),
      text: decodeHtmlEntities(item.text),
    }));
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch transcript: ${String(err)}` });
  }
}

export async function handleVideoInfo(req: Request, res: Response): Promise<void> {
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }

  try {
    const info = await getVideoInfo(filePath);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export function handleTranscript(req: Request, res: Response): void {
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Transcript file not found' });
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const format = ext === '.srt' ? 'srt' : 'vtt';
    const segments = parseTranscript(content, format);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

export function handleTranscriptRaw(req: Request, res: Response): void {
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Missing content' });
    return;
  }
  try {
    const segments = parseTranscriptAuto(content);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

