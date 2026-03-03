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
