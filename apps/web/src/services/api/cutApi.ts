import type { CutRequest, CutResponse, PrepareResult, YoutubeCutRequest } from '../../types';
import { BASE, fetchJson } from './client';

export const cutApi = {
  cutVideo: async (req: CutRequest): Promise<CutResponse> => {
    return fetchJson<CutResponse>(`${BASE}/cut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  cutYoutubeVideo: async (req: YoutubeCutRequest): Promise<CutResponse> => {
    return fetchJson<CutResponse>(`${BASE}/cut/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  prepare: async (req: {
    videoPath?: string;
    youtubeUrl?: string;
    startMs: number;
    endMs: number;
    jobId?: string;
  }): Promise<PrepareResult> => {
    return fetchJson<PrepareResult>(`${BASE}/cut/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  finalize: async (req: {
    sourcePath: string;
    trimStartMs: number;
    trimDurationMs: number;
    audioOffsetMs?: number;
    outputDir?: string;
    outputName?: string;
    jobId?: string;
  }): Promise<CutResponse> => {
    return fetchJson<CutResponse>(`${BASE}/cut/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },
};
