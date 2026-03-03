import { Router } from 'express';
import { handleListJobs, handleGetJob, handleCreateJob, handleUpdateJob, handleDeleteJob } from '../controllers/jobsController';

export const jobsRouter = Router();

jobsRouter.get('/', handleListJobs);
jobsRouter.get('/:id', handleGetJob);
jobsRouter.post('/', handleCreateJob);
jobsRouter.patch('/:id', handleUpdateJob);
jobsRouter.delete('/:id', handleDeleteJob);
