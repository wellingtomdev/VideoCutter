import type { SuggestClipsRequest, SuggestClipsResponse } from '../../types';
import { BASE, fetchJson } from './client';

export const suggestionsApi = {
  suggestClips: async (data: SuggestClipsRequest): Promise<SuggestClipsResponse> => {
    return fetchJson<SuggestClipsResponse>(`${BASE}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};
