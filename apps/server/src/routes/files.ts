import { Router } from 'express';
import {
  handleYoutubeTranscript,
  handleVideoInfo,
  handleTranscript,
  handleTranscriptRaw,
} from '../controllers/filesController';

export const filesRouter = Router();

filesRouter.get('/youtube-transcript', handleYoutubeTranscript);
filesRouter.get('/info', handleVideoInfo);
filesRouter.get('/transcript', handleTranscript);
filesRouter.post('/transcript-raw', handleTranscriptRaw);
