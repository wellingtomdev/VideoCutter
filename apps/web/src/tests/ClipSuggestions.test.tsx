import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ClipSuggestions } from '../components/editor/ClipSuggestions';
import type { ClipSuggestion, TranscriptSegment } from '../types';

vi.mock('../services/api', () => ({
  api: {
    suggestClips: vi.fn(),
  },
}));

import { api } from '../services/api';

const SEGMENTS: TranscriptSegment[] = [
  { id: 1, startMs: 0, endMs: 10000, text: 'Primeiro segmento' },
  { id: 2, startMs: 10000, endMs: 20000, text: 'Segundo segmento' },
];

const SUGGESTIONS: ClipSuggestion[] = [
  {
    startMs: 0,
    endMs: 20000,
    title: 'Momento impactante',
    description: 'Um trecho poderoso',
    hashtags: ['#fe', '#pregacao'],
    category: 'exortacao',
    score: 9,
  },
  {
    startMs: 10000,
    endMs: 30000,
    title: 'Ensino profundo',
    description: 'Explicação teológica',
    hashtags: ['#biblia'],
    category: 'ensino',
    score: 7,
  },
];

const defaultProps = {
  jobId: 'job-123',
  transcript: SEGMENTS,
  suggestions: [] as ClipSuggestion[],
  startMs: 0,
  endMs: 60000,
  durationMs: 60000,
  onSeek: vi.fn(),
  onSetRange: vi.fn(),
  onSuggestionsGenerated: vi.fn(),
};

describe('ClipSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Gerar Sugestões" button enabled when transcript exists', () => {
    const { getByText } = render(<ClipSuggestions {...defaultProps} />);
    const btn = getByText('Gerar Sugestões');
    expect(btn).toBeTruthy();
    expect(btn.closest('button')!.disabled).toBe(false);
  });

  it('disables button when transcript is empty', () => {
    const { getByText } = render(<ClipSuggestions {...defaultProps} transcript={[]} />);
    const btn = getByText('Gerar Sugestões');
    expect(btn.closest('button')!.disabled).toBe(true);
  });

  it('shows loading state when generating suggestions', async () => {
    vi.mocked(api.suggestClips).mockReturnValue(new Promise(() => {})); // never resolves

    const { getByText } = render(<ClipSuggestions {...defaultProps} />);
    fireEvent.click(getByText('Gerar Sugestões'));

    expect(getByText('Analisando transcrição...')).toBeTruthy();
  });

  it('calls api.suggestClips with correct params', async () => {
    vi.mocked(api.suggestClips).mockResolvedValue({ suggestions: [] });

    const { getByText } = render(<ClipSuggestions {...defaultProps} />);
    fireEvent.click(getByText('Gerar Sugestões'));

    await waitFor(() => {
      expect(api.suggestClips).toHaveBeenCalledWith({
        jobId: 'job-123',
        rangeStartMs: undefined,
        rangeEndMs: undefined,
        categories: undefined,
        model: 'gpt-4o-mini',
      });
    });
  });

  it('calls onSuggestionsGenerated after successful generation', async () => {
    vi.mocked(api.suggestClips).mockResolvedValue({ suggestions: SUGGESTIONS });

    const { getByText } = render(<ClipSuggestions {...defaultProps} />);
    fireEvent.click(getByText('Gerar Sugestões'));

    await waitFor(() => {
      expect(defaultProps.onSuggestionsGenerated).toHaveBeenCalled();
    });
  });

  it('renders suggestions list with category badges', () => {
    const { getByText, getAllByText } = render(<ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} />);

    expect(getByText('Momento impactante')).toBeTruthy();
    expect(getByText('Ensino profundo')).toBeTruthy();
    // "Exortação" and "Ensino" appear both as category chips and as suggestion badges
    expect(getAllByText('Exortação').length).toBeGreaterThanOrEqual(2);
    expect(getAllByText('Ensino').length).toBeGreaterThanOrEqual(2);
  });

  it('shows description and hashtags when card is expanded', () => {
    const { getByText, queryByText } = render(
      <ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} />
    );

    // Description should not be visible initially
    expect(queryByText('Um trecho poderoso')).toBeNull();

    // Click to expand
    fireEvent.click(getByText('Momento impactante'));

    // Now description and hashtags should be visible
    expect(getByText('Um trecho poderoso')).toBeTruthy();
    expect(getByText('#fe')).toBeTruthy();
    expect(getByText('#pregacao')).toBeTruthy();
  });

  it('shows transcript excerpt when card is expanded', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} />
    );

    // Excerpt not visible initially
    expect(queryByTestId('transcript-excerpt-0')).toBeNull();

    // Expand first suggestion (0ms → 20000ms)
    fireEvent.click(getByText('Momento impactante'));

    // Should show transcript segments that overlap with 0-20000ms range
    const excerpt = getByTestId('transcript-excerpt-0');
    expect(excerpt.textContent).toContain('Primeiro segmento');
    expect(excerpt.textContent).toContain('Segundo segmento');
  });

  it('"Visualizar" calls onSeek with correct startMs', () => {
    const onSeek = vi.fn();
    const { getByText, getByTestId } = render(
      <ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} onSeek={onSeek} />
    );

    // Expand first suggestion
    fireEvent.click(getByText('Momento impactante'));

    fireEvent.click(getByTestId('visualize-0'));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('"Usar" calls onSetRange with correct startMs and endMs', () => {
    const onSetRange = vi.fn();
    const { getByText, getByTestId } = render(
      <ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} onSetRange={onSetRange} />
    );

    // Expand first suggestion
    fireEvent.click(getByText('Momento impactante'));

    fireEvent.click(getByTestId('use-0'));
    expect(onSetRange).toHaveBeenCalledWith(0, 20000);
  });

  it('shows range selection toggle with formatted timestamps', () => {
    const { getByText } = render(
      <ClipSuggestions {...defaultProps} startMs={5000} endMs={30000} durationMs={60000} />
    );

    expect(getByText('Transcrição completa')).toBeTruthy();
    expect(getByText(/Usar seleção.*0:05.*0:30/)).toBeTruthy();
  });

  it('sends range params when "Usar seleção" is selected', async () => {
    vi.mocked(api.suggestClips).mockResolvedValue({ suggestions: [] });

    const { getByText, getByLabelText } = render(
      <ClipSuggestions {...defaultProps} startMs={5000} endMs={30000} durationMs={60000} />
    );

    // Select "Usar seleção" radio
    const selectionRadio = getByLabelText(/Usar seleção/);
    fireEvent.click(selectionRadio);

    fireEvent.click(getByText('Gerar Sugestões'));

    await waitFor(() => {
      expect(api.suggestClips).toHaveBeenCalledWith({
        jobId: 'job-123',
        rangeStartMs: 5000,
        rangeEndMs: 30000,
        categories: undefined,
        model: 'gpt-4o-mini',
      });
    });
  });

  it('shows error when API call fails', async () => {
    vi.mocked(api.suggestClips).mockRejectedValue(new Error('OPENAI_API_KEY não configurada'));

    const { getByText, getByTestId } = render(<ClipSuggestions {...defaultProps} />);
    fireEvent.click(getByText('Gerar Sugestões'));

    await waitFor(() => {
      expect(getByTestId('suggestions-error').textContent).toMatch(/OPENAI_API_KEY/);
    });
  });

  it('renders category filter chips', () => {
    const { getByText } = render(<ClipSuggestions {...defaultProps} />);

    expect(getByText('Exortação')).toBeTruthy();
    expect(getByText('Encorajamento')).toBeTruthy();
    expect(getByText('Ensino')).toBeTruthy();
    expect(getByText('Humor')).toBeTruthy();
  });

  it('sends selected categories when generating', async () => {
    vi.mocked(api.suggestClips).mockResolvedValue({ suggestions: [] });

    const { getByText } = render(<ClipSuggestions {...defaultProps} />);

    // Select some category chips
    fireEvent.click(getByText('Ensino'));
    fireEvent.click(getByText('Humor'));

    fireEvent.click(getByText('Gerar Sugestões'));

    await waitFor(() => {
      expect(api.suggestClips).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ['ensino', 'humor'],
        })
      );
    });
  });

  it('displays duration for each suggestion', () => {
    const { getByText } = render(<ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} />);
    expect(getByText(/0:00 → 0:20 · 20s/)).toBeTruthy();
    expect(getByText(/0:10 → 0:30 · 20s/)).toBeTruthy();
  });

  it('displays score badge for each suggestion', () => {
    const { getByTestId } = render(<ClipSuggestions {...defaultProps} suggestions={SUGGESTIONS} />);
    expect(getByTestId('score-0').textContent).toBe('9/10');
    expect(getByTestId('score-1').textContent).toBe('7/10');
  });

  describe('pagination', () => {
    const makeSuggestions = (count: number): ClipSuggestion[] =>
      Array.from({ length: count }, (_, i) => ({
        startMs: i * 1000,
        endMs: (i + 1) * 1000 + 20000,
        title: `Sugestão ${i + 1}`,
        description: `Descrição ${i + 1}`,
        hashtags: [`#tag${i}`],
        category: 'ensino' as const,
        score: 10 - Math.floor(i / 2),
      }));

    it('does not show pagination when suggestions <= 10', () => {
      const { queryByTestId } = render(
        <ClipSuggestions {...defaultProps} suggestions={makeSuggestions(10)} />
      );
      expect(queryByTestId('pagination')).toBeNull();
    });

    it('shows pagination when suggestions > 10', () => {
      const { getByTestId } = render(
        <ClipSuggestions {...defaultProps} suggestions={makeSuggestions(12)} />
      );
      expect(getByTestId('pagination')).toBeTruthy();
      expect(getByTestId('pagination-info').textContent).toBe('Página 1 de 2');
    });

    it('navigates pages with previous/next buttons', () => {
      const { getByTestId, getByText, queryByText } = render(
        <ClipSuggestions {...defaultProps} suggestions={makeSuggestions(12)} />
      );

      // Page 1: shows suggestions 1-10
      expect(getByText('Sugestão 1')).toBeTruthy();
      expect(getByText('Sugestão 10')).toBeTruthy();
      expect(queryByText('Sugestão 11')).toBeNull();

      // Previous disabled on first page
      expect(getByTestId('pagination-prev').hasAttribute('disabled')).toBe(true);

      // Go to page 2
      fireEvent.click(getByTestId('pagination-next'));
      expect(getByTestId('pagination-info').textContent).toBe('Página 2 de 2');
      expect(getByText('Sugestão 11')).toBeTruthy();
      expect(getByText('Sugestão 12')).toBeTruthy();
      expect(queryByText('Sugestão 1')).toBeNull();

      // Next disabled on last page
      expect(getByTestId('pagination-next').hasAttribute('disabled')).toBe(true);

      // Go back to page 1
      fireEvent.click(getByTestId('pagination-prev'));
      expect(getByTestId('pagination-info').textContent).toBe('Página 1 de 2');
      expect(getByText('Sugestão 1')).toBeTruthy();
    });
  });
});
