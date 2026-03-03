import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

// Mock youtube-transcript-plus so tests don't hit the real API
vi.mock('youtube-transcript-plus', () => ({
  fetchTranscript: vi.fn(async (videoId: string) => {
    if (videoId === 'validVidId1') {
      return [
        { text: 'Hello world', offset: 0, duration: 2.5, lang: 'en' },
        { text: 'I&#39;ve been coding', offset: 2.5, duration: 3.0, lang: 'en' },
        { text: 'For a long time &amp; loving it', offset: 5.5, duration: 2.0, lang: 'en' },
      ];
    }
    throw new Error('Transcript not available');
  }),
}));

describe('GET /files/youtube-transcript', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).get('/files/youtube-transcript');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing url/i);
  });

  it('returns 400 for unrecognized URL', async () => {
    const res = await request(app).get('/files/youtube-transcript?url=https://notyoutube.com/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/video id/i);
  });

  it('returns segments from youtube.com watch URL', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=' + encodeURIComponent('https://www.youtube.com/watch?v=validVidId1'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({ id: 0, startMs: 0, endMs: 2500, text: 'Hello world' });
  });

  it('returns segments from youtu.be short URL', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=' + encodeURIComponent('https://youtu.be/validVidId1'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('accepts raw video ID', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=validVidId1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('decodes HTML entities in text', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=validVidId1');
    expect(res.body[1].text).toBe("I've been coding");
    expect(res.body[2].text).toBe('For a long time & loving it');
  });

  it('returns 500 when transcript is unavailable', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=' + encodeURIComponent('https://youtu.be/unavailableId'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/transcript/i);
  });

  it('extracts video ID from /shorts/ URL', async () => {
    const res = await request(app)
      .get('/files/youtube-transcript?url=' + encodeURIComponent('https://www.youtube.com/shorts/validVidId1'));
    expect(res.status).toBe(200);
  });
});
