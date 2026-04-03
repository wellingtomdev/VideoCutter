import type { CutRequest, CutResponse, PrepareResult, PrepareProgress, YoutubeCutRequest } from '../../types';
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
  }, signal?: AbortSignal): Promise<PrepareResult> => {
    return fetchJson<PrepareResult>(`${BASE}/cut/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
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

  subscribePrepareProgress: (
    jobId: string,
    onUpdate: (data: PrepareProgress) => void,
  ): (() => void) => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${BASE}/cut/prepare-progress/${jobId}`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as PrepareProgress;
                onUpdate(data);
              } catch { /* ignore parse errors */ }
            }
          }
        }
      } catch {
        // aborted or network error — ignore
      }
    })();

    return () => controller.abort();
  },
};
