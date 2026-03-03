import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../services/transcriptParser';

describe('parseTranscript - VTT', () => {
  it('parses valid VTT file', () => {
    const content = `WEBVTT

00:01:23.456 --> 00:01:25.678
Hello world

00:01:26.000 --> 00:01:28.000
Second line
`;
    const result = parseTranscript(content, 'vtt');
    expect(result).toHaveLength(2);
    expect(result[0].startMs).toBe(83456);
    expect(result[0].endMs).toBe(85678);
    expect(result[0].text).toBe('Hello world');
  });

  it('parses VTT without hours (MM:SS.mmm)', () => {
    const content = `WEBVTT

01:23.456 --> 01:25.678
Short format
`;
    const result = parseTranscript(content, 'vtt');
    expect(result).toHaveLength(1);
    expect(result[0].startMs).toBe(83456);
  });

  it('ignores cue IDs and metadata', () => {
    const content = `WEBVTT

NOTE This is metadata

1
00:00:01.000 --> 00:00:02.000
Text with cue ID
`;
    const result = parseTranscript(content, 'vtt');
    expect(result[0].text).toBe('Text with cue ID');
  });

  it('returns empty array for empty file', () => {
    expect(parseTranscript('', 'vtt')).toEqual([]);
    expect(parseTranscript('   ', 'vtt')).toEqual([]);
  });

  it('strips HTML tags from VTT', () => {
    const content = `WEBVTT

00:00:01.000 --> 00:00:02.000
<c.colorE5E5E5>Hello</c> world
`;
    const result = parseTranscript(content, 'vtt');
    expect(result[0].text).toBe('Hello world');
  });
});

describe('parseTranscript - SRT', () => {
  it('parses valid SRT file', () => {
    const content = `1
00:01:23,456 --> 00:01:25,678
Hello world

2
00:01:26,000 --> 00:01:28,000
Second line
`;
    const result = parseTranscript(content, 'srt');
    expect(result).toHaveLength(2);
    expect(result[0].startMs).toBe(83456);
    expect(result[0].text).toBe('Hello world');
  });

  it('returns empty array for empty SRT', () => {
    expect(parseTranscript('', 'srt')).toEqual([]);
  });

  it('handles SRT without cue numbers', () => {
    const content = `00:00:01,000 --> 00:00:02,000
Text without number
`;
    const result = parseTranscript(content, 'srt');
    expect(result[0].text).toBe('Text without number');
  });
});