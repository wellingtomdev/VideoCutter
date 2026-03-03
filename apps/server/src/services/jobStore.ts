import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Job, CreateJobRequest, UpdateJobRequest } from '@video-cutter/types';

const DEFAULT_JOBS_DIR = path.resolve(process.cwd(), 'jobs');

export function getJobsDir(): string {
  return process.env.JOBS_DIR || DEFAULT_JOBS_DIR;
}

export function getJobDir(id: string): string {
  return path.join(getJobsDir(), id);
}

function metadataPath(id: string): string {
  return path.join(getJobDir(id), 'metadata.json');
}

function readMetadata(id: string): Job {
  const filePath = metadataPath(id);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Job not found: ${id}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Job;
}

function writeMetadata(job: Job): void {
  const dir = getJobDir(job.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metadataPath(job.id), JSON.stringify(job, null, 2), 'utf-8');
}

export async function createJob(data: CreateJobRequest): Promise<Job> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const job: Job = {
    id,
    title: data.title || generateTitle(data),
    status: 'setup',
    source: data.source,
    transcript: data.transcript,
    createdAt: now,
    updatedAt: now,
  };

  writeMetadata(job);
  return job;
}

export async function getJob(id: string): Promise<Job> {
  return readMetadata(id);
}

export async function listJobs(): Promise<Job[]> {
  const dir = getJobsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const jobs: Job[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = path.join(dir, entry.name, 'metadata.json');
    if (!fs.existsSync(meta)) continue;
    try {
      const raw = fs.readFileSync(meta, 'utf-8');
      jobs.push(JSON.parse(raw) as Job);
    } catch {
      // Skip corrupted entries
    }
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

export async function updateJob(id: string, data: UpdateJobRequest): Promise<Job> {
  const existing = readMetadata(id);

  // Separate prepare, newCutEntry, removeCutId from rest to handle specially
  const { prepare: prepareValue, newCutEntry, removeCutId, ...rest } = data;

  const updated: Job = {
    ...existing,
    ...rest,
    id: existing.id,
    createdAt: existing.createdAt,
    source: existing.source,
    transcript: existing.transcript,
    cuts: existing.cuts,
    updatedAt: new Date().toISOString(),
  };

  // Handle prepare field: null clears it, PrepareResult sets it
  if ('prepare' in data) {
    if (prepareValue === null) {
      delete updated.prepare;
    } else if (prepareValue) {
      updated.prepare = prepareValue;
    }
  }

  // Handle newCutEntry: append to cuts array
  if (newCutEntry) {
    const entry = {
      ...newCutEntry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    updated.cuts = [...(updated.cuts ?? []), entry];
  }

  // Handle removeCutId: remove cut from array and delete its output file
  if (removeCutId && updated.cuts) {
    const cutToRemove = updated.cuts.find(c => c.id === removeCutId);
    if (cutToRemove) {
      // Delete the output file from disk
      try {
        if (fs.existsSync(cutToRemove.output.filePath)) {
          fs.unlinkSync(cutToRemove.output.filePath);
        }
      } catch {
        // Ignore file deletion errors
      }
      updated.cuts = updated.cuts.filter(c => c.id !== removeCutId);
    }
  }

  writeMetadata(updated);
  return updated;
}

export async function deleteJob(id: string): Promise<void> {
  const dir = getJobDir(id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Job not found: ${id}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function generateTitle(data: CreateJobRequest): string {
  if (data.source.type === 'youtube' && data.source.youtubeUrl) {
    return `YouTube - ${data.source.videoId || 'video'}`;
  }
  if (data.source.type === 'local' && data.source.path) {
    return path.basename(data.source.path, path.extname(data.source.path));
  }
  return `Job ${new Date().toLocaleDateString('pt-BR')}`;
}
