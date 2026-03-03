import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFile } from '../utils/downloadFile';

describe('downloadFile', () => {
  let originalShowSaveFilePicker: unknown;

  beforeEach(() => {
    originalShowSaveFilePicker = (window as Record<string, unknown>).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalShowSaveFilePicker) {
      (window as Record<string, unknown>).showSaveFilePicker = originalShowSaveFilePicker;
    } else {
      delete (window as Record<string, unknown>).showSaveFilePicker;
    }
  });

  describe('with File System Access API', () => {
    it('uses showSaveFilePicker when available', async () => {
      const mockWritable = {
        close: vi.fn(),
      };
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      const mockShowSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);
      (window as Record<string, unknown>).showSaveFilePicker = mockShowSaveFilePicker;

      const mockBody = {
        pipeTo: vi.fn().mockResolvedValue(undefined),
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      await downloadFile('http://localhost:3001/stream?path=test.mp4', 'clip.mp4');

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
        suggestedName: 'clip.mp4',
      }));
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/stream?path=test.mp4');
      expect(mockBody.pipeTo).toHaveBeenCalledWith(mockWritable);
    });

    it('does nothing when user cancels the dialog (AbortError)', async () => {
      const abortError = new DOMException('User cancelled', 'AbortError');
      const mockShowSaveFilePicker = vi.fn().mockRejectedValue(abortError);
      (window as Record<string, unknown>).showSaveFilePicker = mockShowSaveFilePicker;

      // Should not throw
      await downloadFile('http://localhost:3001/stream?path=test.mp4', 'clip.mp4');

      expect(mockShowSaveFilePicker).toHaveBeenCalled();
    });

    it('extracts the file extension from suggestedName', async () => {
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue({ close: vi.fn() }),
      };
      const mockShowSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);
      (window as Record<string, unknown>).showSaveFilePicker = mockShowSaveFilePicker;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { pipeTo: vi.fn().mockResolvedValue(undefined) },
      });

      await downloadFile('http://example.com/file', 'video.webm');

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
        types: [expect.objectContaining({
          accept: { 'video/*': ['.webm'] },
        })],
      }));
    });
  });

  describe('fallback (no File System Access API)', () => {
    it('falls back to <a download> when showSaveFilePicker is not available', async () => {
      delete (window as Record<string, unknown>).showSaveFilePicker;

      const mockBlob = new Blob(['fake video data']);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      const mockUrl = 'blob:http://localhost/fake-blob-url';
      const createObjectURL = vi.fn().mockReturnValue(mockUrl);
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        // Simulate the click being set up
        return node;
      });
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          el.click = mockClick;
        }
        return el;
      });

      await downloadFile('http://localhost:3001/stream?path=test.mp4', 'clip.mp4');

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/stream?path=test.mp4');
      expect(createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockClick).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);

      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });
});
