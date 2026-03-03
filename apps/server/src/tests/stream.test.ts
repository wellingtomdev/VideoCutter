import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('GET /stream', () => {
  it('returns 400 when path is missing', async () => {
    const res = await request(app).get('/stream');
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent file', async () => {
    const res = await request(app).get('/stream?path=/nonexistent/file.mp4');
    expect(res.status).toBe(404);
  });
});
