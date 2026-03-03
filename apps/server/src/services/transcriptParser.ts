import type { TranscriptSegment } from '@video-cutter/types';

function parseTimestamp(ts: string, format: 'vtt' | 'srt'): number {
  // Normalize: SRT uses comma, VTT uses dot for milliseconds
  const normalized = format === 'srt' ? ts.replace(',', '.') : ts;

  // Support both HH:MM:SS.mmm and MM:SS.mmm
  const parts = normalized.split(':');
  if (parts.length === 2) {
    // MM:SS.mmm
    const [mm, ssmm] = parts;
    const [ss, ms = '0'] = ssmm.split('.');
    return (
      parseInt(mm, 10) * 60000 +
      parseInt(ss, 10) * 1000 +
      parseInt(ms.padEnd(3, '0').slice(0, 3), 10)
    );
  } else if (parts.length === 3) {
    // HH:MM:SS.mmm
    const [hh, mm, ssmm] = parts;
    const [ss, ms = '0'] = ssmm.split('.');
    return (
      parseInt(hh, 10) * 3600000 +
      parseInt(mm, 10) * 60000 +
      parseInt(ss, 10) * 1000 +
      parseInt(ms.padEnd(3, '0').slice(0, 3), 10)
    );
  }

  throw new Error(`Invalid timestamp format: ${ts}`);
}

export function parseTranscript(content: string, format: 'vtt' | 'srt'): TranscriptSegment[] {
  if (!content.trim()) return [];
  return format === 'vtt' ? parseVtt(content) : parseSrt(content);
}

/** Auto-detect and parse any supported format (VTT, SRT, YouTube plain text). */
export function parseTranscriptAuto(content: string): TranscriptSegment[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('WEBVTT')) return parseVtt(trimmed);
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}/.test(trimmed)) return parseSrt(trimmed);
  if (/^\d+:\d{2}/.test(trimmed)) return parseYoutubeText(trimmed);
  // fallback: try SRT then VTT
  try { const r = parseSrt(trimmed); if (r.length) return r; } catch {}
  return parseVtt(trimmed);
}

/** Parse YouTube copy-pasted transcript format:
 *  0:00
 *  Some text here
 *  0:03
 *  More text
 */
export function parseYoutubeText(content: string): TranscriptSegment[] {
  if (!content.trim()) return [];

  const TIMESTAMP_RE = /^(\d+):(\d{2})(?::(\d{2}))?$/;
  const lines = content.split('\n').map((l) => l.trim());

  const cues: { startMs: number; text: string }[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(TIMESTAMP_RE);
    if (match) {
      const [, a, b, c] = match;
      const startMs =
        c !== undefined
          ? parseInt(a) * 3600000 + parseInt(b) * 60000 + parseInt(c) * 1000
          : parseInt(a) * 60000 + parseInt(b) * 1000;

      i++;
      const textLines: string[] = [];
      while (i < lines.length && !lines[i].match(TIMESTAMP_RE)) {
        if (lines[i]) textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').trim();
      if (text) cues.push({ startMs, text });
    } else {
      i++;
    }
  }

  return cues.map((cue, idx) => ({
    id: idx,
    startMs: cue.startMs,
    endMs: cues[idx + 1]?.startMs ?? cue.startMs + 5000,
    text: cue.text,
  }));
}

function parseVtt(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = content.split('\n');
  let id = 0;
  let i = 0;

  // Skip WEBVTT header and metadata
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim().split(' ')[0]);

      try {
        const startMs = parseTimestamp(startStr, 'vtt');
        const endMs = parseTimestamp(endStr, 'vtt');

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }

        const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();
        if (text) {
          segments.push({ id: id++, startMs, endMs, text });
        }
      } catch {
        i++;
      }
    } else {
      i++;
    }
  }

  return segments.sort((a, b) => a.startMs - b.startMs);
}

function parseSrt(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // First line may be a number (cue ID)
    let timeLineIndex = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());

    try {
      const startMs = parseTimestamp(startStr, 'srt');
      const endMs = parseTimestamp(endStr, 'srt');
      const text = lines
        .slice(timeLineIndex + 1)
        .join(' ')
        .trim();

      if (text) {
        segments.push({
          id: segments.length,
          startMs,
          endMs,
          text,
        });
      }
    } catch {
      continue;
    }
  }

  return segments.sort((a, b) => a.startMs - b.startMs);
}
