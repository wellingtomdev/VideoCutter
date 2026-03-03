import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

vi.mock('../services/nativeDialog', () => ({
  showOpenFileDialog: vi.fn(),
}));

import { showOpenFileDialog } from '../services/nativeDialog';

describe('POST /dialog/open-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the selected file path', async () => {
    vi.mocked(showOpenFileDialog).mockReturnValue('C:\\Users\\test\\video.mp4');

    const res = await request(app)
      .post('/dialog/open-file')
      .send({ filter: 'video', title: 'Selecionar video' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: 'C:\\Users\\test\\video.mp4' });
  });

  it('returns null path when user cancels', async () => {
    vi.mocked(showOpenFileDialog).mockReturnValue(null);

    const res = await request(app)
      .post('/dialog/open-file')
      .send({ filter: 'video' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: null });
  });

  it('passes filter and title to showOpenFileDialog', async () => {
    vi.mocked(showOpenFileDialog).mockReturnValue(null);

    await request(app)
      .post('/dialog/open-file')
      .send({ filter: 'transcript', title: 'Selecionar Transcrição' });

    expect(showOpenFileDialog).toHaveBeenCalledWith({
      title: 'Selecionar Transcrição',
      filter: 'transcript',
    });
  });

  it('works without body parameters', async () => {
    vi.mocked(showOpenFileDialog).mockReturnValue(null);

    const res = await request(app)
      .post('/dialog/open-file')
      .send({});

    expect(res.status).toBe(200);
    expect(showOpenFileDialog).toHaveBeenCalledWith({
      title: undefined,
      filter: undefined,
    });
  });
});

describe('Removed routes', () => {
  it('GET /files/browse returns 404', async () => {
    const res = await request(app).get('/files/browse?dir=C:\\');
    expect(res.status).toBe(404);
  });

  it('GET /files/homedir returns 404', async () => {
    const res = await request(app).get('/files/homedir');
    expect(res.status).toBe(404);
  });
});
