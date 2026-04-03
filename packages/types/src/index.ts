export interface TranscriptSegment {
  id: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface CutRequest {
  videoPath: string;
  outputDir: string;
  startMs: number;
  endMs: number;
  outputName?: string;
  audioOffsetMs?: number;
}

export interface CutResponse {
  outputPath: string;
  durationMs: number;
  jobId?: string;
}

export interface YoutubeCutRequest {
  youtubeUrl: string;
  startMs: number;
  endMs: number;
  outputDir?: string;
  outputName?: string;
  audioOffsetMs?: number;
}

export interface VideoInfo {
  path: string;
  durationMs: number;
  width: number;
  height: number;
}

export interface PrepareResult {
  filePath: string;
  paddingBeforeMs: number;
  paddingAfterMs: number;
  originalDurationMs: number;
}

export type ClipCategory =
  | 'exortacao'
  | 'encorajamento'
  | 'ensino'
  | 'testemunho'
  | 'adoracao'
  | 'reflexao'
  | 'chamado'
  | 'humor'
  | 'ilustracao';

export interface ClipSuggestion {
  startMs: number;
  endMs: number;
  title: string;
  description: string;
  hashtags: string[];
  category: ClipCategory;
  score: number;
}

export type SuggestionModel = 'gpt-4o-mini' | 'gpt-4o';

export interface SuggestClipsRequest {
  jobId: string;
  rangeStartMs?: number;
  rangeEndMs?: number;
  categories?: ClipCategory[];
  model?: SuggestionModel;
}

export interface SuggestClipsResponse {
  suggestions: ClipSuggestion[];
}

// ── Prepare Progress ───────────────────────────────────────────────────────

export type PreparePhase = 'downloading' | 'merging' | 'done' | 'error';

export interface PrepareProgress {
  phase: PreparePhase;
  progress: number;       // 0-100
  message: string;
  done: boolean;
  error?: string;
}

// ── Job System ──────────────────────────────────────────────────────────────

export type JobStatus = 'setup' | 'ready' | 'preparing' | 'cutting' | 'done' | 'error';

export interface JobSource {
  type: 'local' | 'youtube';
  path?: string;
  youtubeUrl?: string;
  videoId?: string;
}

export interface JobCut {
  startMs: number;
  endMs: number;
  audioOffsetMs: number;
}

export interface JobOutput {
  filePath: string;
  durationMs: number;
  fileSize?: number;
}

export interface JobCutEntry {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  audioOffsetMs: number;
  output: JobOutput;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  status: JobStatus;
  source: JobSource;
  cut?: JobCut;
  output?: JobOutput;
  cuts?: JobCutEntry[];
  suggestions?: ClipSuggestion[];
  prepare?: PrepareResult;
  transcript?: TranscriptSegment[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface CreateJobRequest {
  title?: string;
  source: JobSource;
  transcript?: TranscriptSegment[];
}

export interface UpdateJobRequest {
  title?: string;
  status?: JobStatus;
  cut?: JobCut;
  output?: JobOutput;
  prepare?: PrepareResult | null;
  suggestions?: ClipSuggestion[];
  transcript?: TranscriptSegment[];
  newCutEntry?: Omit<JobCutEntry, 'id' | 'createdAt'>;
  removeCutId?: string;
  error?: string;
}
