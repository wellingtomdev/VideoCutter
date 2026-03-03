import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI before importing llmService
const mockParse = vi.fn();
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          parse: mockParse,
        },
      },
    })),
  };
});

// Mock config
vi.mock('../config', () => ({
  config: {
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-4o-mini',
  },
}));

import { filterSegments, formatTranscript, suggestClips } from '../services/llmService';
import { config } from '../config';
import type { TranscriptSegment } from '@video-cutter/types';

const SEGMENTS: TranscriptSegment[] = [
  { id: 1, startMs: 0, endMs: 10000, text: 'Primeiro segmento' },
  { id: 2, startMs: 10000, endMs: 20000, text: 'Segundo segmento' },
  { id: 3, startMs: 20000, endMs: 30000, text: 'Terceiro segmento' },
  { id: 4, startMs: 30000, endMs: 40000, text: 'Quarto segmento' },
  { id: 5, startMs: 40000, endMs: 50000, text: 'Quinto segmento' },
];

describe('llmService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── filterSegments ───────────────────────────────────────────────────────

  describe('filterSegments', () => {
    it('returns all segments when no range is provided', () => {
      expect(filterSegments(SEGMENTS)).toEqual(SEGMENTS);
    });

    it('filters by range start and end', () => {
      const result = filterSegments(SEGMENTS, 15000, 35000);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(4);
    });

    it('filters by range start only', () => {
      const result = filterSegments(SEGMENTS, 25000);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(3);
    });

    it('filters by range end only', () => {
      const result = filterSegments(SEGMENTS, undefined, 25000);
      expect(result).toHaveLength(3);
      expect(result[2].id).toBe(3);
    });

    it('returns empty when range excludes all segments', () => {
      const result = filterSegments(SEGMENTS, 60000, 70000);
      expect(result).toHaveLength(0);
    });

    it('includes segments that partially overlap the range', () => {
      // Range starts at 5000 (middle of segment 1)
      const result = filterSegments(SEGMENTS, 5000, 15000);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });
  });

  // ── formatTranscript ─────────────────────────────────────────────────────

  describe('formatTranscript', () => {
    it('formats timestamps in milliseconds with human-readable prefix', () => {
      const result = formatTranscript([SEGMENTS[0]]);
      expect(result).toBe('[0:00 | 0ms → 10000ms] Primeiro segmento');
    });

    it('formats multiple segments with newlines', () => {
      const result = formatTranscript(SEGMENTS.slice(0, 2));
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('0ms');
      expect(lines[0]).toContain('Primeiro segmento');
      expect(lines[1]).toContain('Segundo segmento');
    });

    it('includes exact ms values for large timestamps', () => {
      const seg: TranscriptSegment = { id: 1, startMs: 65000, endMs: 130000, text: 'test' };
      const result = formatTranscript([seg]);
      expect(result).toBe('[1:05 | 65000ms → 130000ms] test');
    });
  });

  // ── suggestClips ─────────────────────────────────────────────────────────

  describe('suggestClips', () => {
    it('returns suggestions on success and strips reasoning', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              analysis: 'Análise geral da transcrição...',
              suggestions: [
                {
                  reasoning: 'Escolhi este trecho porque...',
                  startMs: 0,
                  endMs: 30000,
                  title: 'Momento impactante',
                  description: 'Um trecho poderoso',
                  hashtags: ['#fe', '#pregacao'],
                  category: 'exortacao',
                  score: 8,
                },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Momento impactante');
      expect(result[0].category).toBe('exortacao');
      expect(result[0].score).toBe(8);
      // reasoning must NOT leak to the output
      expect((result[0] as any).reasoning).toBeUndefined();
    });

    it('throws when API key is empty', async () => {
      vi.mocked(config).openaiApiKey = '';
      await expect(suggestClips({ segments: SEGMENTS })).rejects.toThrow('OPENAI_API_KEY');
      vi.mocked(config).openaiApiKey = 'test-key';
    });

    it('throws when no segments provided', async () => {
      await expect(suggestClips({ segments: [] })).rejects.toThrow('Nenhum segmento');
    });

    it('throws when no segments in range', async () => {
      await expect(
        suggestClips({ segments: SEGMENTS, rangeStartMs: 60000, rangeEndMs: 70000 })
      ).rejects.toThrow('Nenhum segmento');
    });

    it('returns empty array on invalid LLM response', async () => {
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: null } }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toEqual([]);
    });

    // ── Post-LLM validation ────────────────────────────────────────────────

    it('removes suggestions where startMs >= endMs', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 30000, endMs: 10000, title: 'Invertido', description: '', hashtags: [], category: 'ensino', score: 7 },
                { startMs: 0, endMs: 45000, title: 'Valido', description: '', hashtags: [], category: 'ensino', score: 8 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valido');
    });

    it('removes suggestions with duration outside 20-95s', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 15000, title: 'Muito curto', description: '', hashtags: [], category: 'ensino', score: 7 },
                { startMs: 0, endMs: 100000, title: 'Muito longo', description: '', hashtags: [], category: 'ensino', score: 7 },
                { startMs: 0, endMs: 45000, title: 'Duração OK', description: '', hashtags: [], category: 'ensino', score: 7 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Duração OK');
    });

    it('removes suggestions outside the requested range', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 40000, title: 'Fora do range', description: '', hashtags: [], category: 'ensino', score: 7 },
                { startMs: 10000, endMs: 40000, title: 'Dentro do range', description: '', hashtags: [], category: 'ensino', score: 7 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({
        segments: SEGMENTS,
        rangeStartMs: 10000,
        rangeEndMs: 50000,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Dentro do range');
    });

    it('normalizes timestamps from seconds to ms when LLM returns seconds', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 40, title: 'Em segundos', description: '', hashtags: [], category: 'ensino', score: 7 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(1);
      // Should be converted to ms
      expect(result[0].startMs).toBe(0);
      expect(result[0].endMs).toBe(40000);
      expect(result[0].title).toBe('Em segundos');
    });

    it('passes categories to the LLM', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: { suggestions: [] },
          },
        }],
      });

      await suggestClips({ segments: SEGMENTS, categories: ['ensino', 'humor'] });

      const systemMsg = mockParse.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain('ensino');
      expect(systemMsg).toContain('humor');
    });

    it('filters suggestions by selected categories', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 40000, title: 'Ensino clip', description: '', hashtags: [], category: 'ensino', score: 8 },
                { startMs: 0, endMs: 40000, title: 'Humor clip', description: '', hashtags: [], category: 'humor', score: 7 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS, categories: ['ensino'] });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Ensino clip');
    });

    it('sorts suggestions by score descending', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 30000, title: 'Score baixo', description: '', hashtags: [], category: 'ensino', score: 5 },
                { startMs: 31000, endMs: 61000, title: 'Score alto', description: '', hashtags: [], category: 'ensino', score: 9 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Score alto');
      expect(result[0].score).toBe(9);
      expect(result[1].title).toBe('Score baixo');
      expect(result[1].score).toBe(5);
    });

    it('clamps score to 1-10 range', async () => {
      mockParse.mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              suggestions: [
                { startMs: 0, endMs: 30000, title: 'Score alto demais', description: '', hashtags: [], category: 'ensino', score: 15 },
                { startMs: 31000, endMs: 61000, title: 'Score negativo', description: '', hashtags: [], category: 'humor', score: -2 },
              ],
            },
          },
        }],
      });

      const result = await suggestClips({ segments: SEGMENTS });
      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(10);
      expect(result[1].score).toBe(1);
    });
  });
});
