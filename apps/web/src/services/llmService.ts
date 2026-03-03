import type { ClipSuggestion, TranscriptSegment } from '../types';

/**
 * Placeholder for future LLM integration.
 * Will auto-select best clip intervals and generate titles, descriptions, hashtags.
 */
export async function suggestClips(
  _segments: TranscriptSegment[],
  _videoTitle?: string
): Promise<ClipSuggestion[]> {
  throw new Error('LLM integration not yet implemented');
}
