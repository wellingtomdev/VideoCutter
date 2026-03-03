import { Router } from 'express';
import { handleStream } from '../controllers/streamController';

export const streamRouter = Router();

streamRouter.get('/', handleStream);
