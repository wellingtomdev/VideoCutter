import type { TranscriptSegment, VideoInfo } from '../../types';
import { BASE, fetchJson } from './client';

export const filesApi = {
  openFileDialog: async (filter?: string, title?: string): Promise<string | null> => {
    const data = await fetchJson<{ path: string | null }>(`${BASE}/dialog/open-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, title }),
    });
    return data.path;
  },

  getVideoInfo: async (filePath: string): Promise<VideoInfo> => {
    return fetchJson<VideoInfo>(`${BASE}/files/info?path=${encodeURIComponent(filePath)}`);
  },

  parseTranscript: async (filePath: string): Promise<TranscriptSegment[]> => {
    return fetchJson<TranscriptSegment[]>(`${BASE}/files/transcript?path=${encodeURIComponent(filePath)}`);
  },

  parseTranscriptRaw: async (content: string): Promise<TranscriptSegment[]> => {
    return fetchJson<TranscriptSegment[]>(`${BASE}/files/transcript-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  },

  youtubeTranscript: async (url: string): Promise<TranscriptSegment[]> => {
    return fetchJson<TranscriptSegment[]>(`${BASE}/files/youtube-transcript?url=${encodeURIComponent(url)}`);
  },

  streamUrl: (filePath: string): string =>
    `${BASE}/stream?path=${encodeURIComponent(filePath)}`,
};
