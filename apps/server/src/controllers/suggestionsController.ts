import type { Request, Response, NextFunction } from 'express';
import type { SuggestClipsRequest } from '@video-cutter/types';
import { AppError } from '../middleware/errorHandler';
import { getJob, updateJob } from '../services/jobStore';
import { suggestClips } from '../services/llmService';

export async function handleSuggestClips(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId, rangeStartMs, rangeEndMs, categories, model } = req.body as SuggestClipsRequest;

    if (!jobId) {
      throw new AppError('jobId é obrigatório', 400);
    }

    let job;
    try {
      job = await getJob(jobId);
    } catch {
      throw new AppError(`Job não encontrado: ${jobId}`, 404);
    }

    if (!job.transcript || job.transcript.length === 0) {
      throw new AppError('Job não possui transcrição', 400);
    }

    const suggestions = await suggestClips({
      segments: job.transcript,
      rangeStartMs,
      rangeEndMs,
      categories,
      model,
    });

    await updateJob(jobId, { suggestions });

    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
}
