import { Router } from 'express';
import { handleOpenFile } from '../controllers/dialogController';

export const dialogRouter = Router();

dialogRouter.post('/open-file', handleOpenFile);
