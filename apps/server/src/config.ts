export const config = {
  port: Number(process.env.PORT) || 3001,
  jobsDir: process.env.JOBS_DIR || './jobs',
  paddingMs: 5000,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};
