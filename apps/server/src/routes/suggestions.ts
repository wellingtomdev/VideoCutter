import { Router } from 'express';
import { handleSuggestClips } from '../controllers/suggestionsController';

export const suggestionsRouter = Router();

suggestionsRouter.post('/', handleSuggestClips);
