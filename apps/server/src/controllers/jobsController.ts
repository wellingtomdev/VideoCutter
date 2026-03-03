import type { Request, Response } from 'express';
import { createJob, getJob, listJobs, updateJob, deleteJob } from '../services/jobStore';
import type { CreateJobRequest, UpdateJobRequest } from '@video-cutter/types';

export async function handleListJobs(_req: Request, res: Response): Promise<void> {
  try {
    const jobs = await listJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleGetJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await getJob(req.params.id);
    res.json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

export async function handleCreateJob(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateJobRequest;

  if (!body.source || !body.source.type) {
    res.status(400).json({ error: 'Missing required field: source with type' });
    return;
  }

  if (body.source.type === 'youtube' && !body.source.youtubeUrl) {
    res.status(400).json({ error: 'YouTube source requires youtubeUrl' });
    return;
  }

  if (body.source.type === 'local' && !body.source.path) {
    res.status(400).json({ error: 'Local source requires path' });
    return;
  }

  try {
    const job = await createJob(body);
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleUpdateJob(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateJobRequest;

  try {
    const job = await updateJob(req.params.id, body);
    res.json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

export async function handleDeleteJob(req: Request, res: Response): Promise<void> {
  try {
    await deleteJob(req.params.id);
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}
