import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { streamRouter } from './routes/stream';
import { filesRouter } from './routes/files';
import { cutRouter } from './routes/cut';
import { jobsRouter } from './routes/jobs';
import { dialogRouter } from './routes/dialog';
import { suggestionsRouter } from './routes/suggestions';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// COEP/COOP headers for SharedArrayBuffer support
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use('/stream', streamRouter);
app.use('/files', filesRouter);
app.use('/cut', cutRouter);
app.use('/jobs', jobsRouter);
app.use('/dialog', dialogRouter);
app.use('/suggestions', suggestionsRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`Video Cutter server running at http://localhost:${config.port}`);
  });
}

export { app };
