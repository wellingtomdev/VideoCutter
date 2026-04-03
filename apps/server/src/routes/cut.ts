import { Router } from 'express';
import { handleCut, handleCutYoutube, handlePrepare, handleFinalize, handleProgress, handlePrepareProgress } from '../controllers/cutController';

export const cutRouter = Router();

cutRouter.post('/', handleCut);
cutRouter.post('/youtube', handleCutYoutube);
cutRouter.post('/prepare', handlePrepare);
cutRouter.post('/finalize', handleFinalize);
cutRouter.get('/progress/:jobId', handleProgress);
cutRouter.get('/prepare-progress/:jobId', handlePrepareProgress);
