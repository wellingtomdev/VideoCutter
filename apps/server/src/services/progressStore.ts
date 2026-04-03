import type { PrepareProgress } from '@video-cutter/types';

interface ProgressEntry {
  progress: number;
  done: boolean;
  error?: string;
  outputPath?: string;
}

const jobs = new Map<string, ProgressEntry>();

let lastPreparedPath: string | null = null;

export function setProgress(jobId: string, data: ProgressEntry): void {
  jobs.set(jobId, data);
}

export function getProgress(jobId: string): ProgressEntry | undefined {
  return jobs.get(jobId);
}

export function setLastPreparedPath(p: string | null): void {
  lastPreparedPath = p;
}

export function getLastPreparedPath(): string | null {
  return lastPreparedPath;
}

// ── Prepare progress (phase-based for YouTube downloads) ─────────────────

const prepareJobs = new Map<string, PrepareProgress>();
const prepareListeners = new Map<string, Set<(p: PrepareProgress) => void>>();

export function setPrepareProgress(jobId: string, data: PrepareProgress): void {
  prepareJobs.set(jobId, data);
  const listeners = prepareListeners.get(jobId);
  if (listeners) {
    for (const cb of listeners) cb(data);
  }
}

export function getPrepareProgress(jobId: string): PrepareProgress | undefined {
  return prepareJobs.get(jobId);
}

export function subscribePrepareProgress(
  jobId: string,
  cb: (p: PrepareProgress) => void,
): () => void {
  if (!prepareListeners.has(jobId)) {
    prepareListeners.set(jobId, new Set());
  }
  prepareListeners.get(jobId)!.add(cb);

  // Send current state immediately
  const current = prepareJobs.get(jobId);
  if (current) cb(current);

  return () => {
    const set = prepareListeners.get(jobId);
    if (set) {
      set.delete(cb);
      if (set.size === 0) prepareListeners.delete(jobId);
    }
  };
}

export function clearPrepareProgress(jobId: string): void {
  prepareJobs.delete(jobId);
  prepareListeners.delete(jobId);
}
