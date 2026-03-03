import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { showOpenFileDialog } from '../services/nativeDialog';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('showOpenFileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the file path when user selects a file', () => {
    vi.mocked(execSync).mockReturnValue('C:\\Users\\test\\video.mp4\n');

    const result = showOpenFileDialog({ title: 'Pick video', filter: 'video' });

    expect(result).toBe('C:\\Users\\test\\video.mp4');
  });

  it('returns null when user cancels the dialog', () => {
    vi.mocked(execSync).mockReturnValue('\n');

    const result = showOpenFileDialog({ title: 'Pick video', filter: 'video' });

    expect(result).toBeNull();
  });

  it('returns null when execSync returns empty string', () => {
    vi.mocked(execSync).mockReturnValue('');

    const result = showOpenFileDialog();

    expect(result).toBeNull();
  });

  it('returns null when execSync throws an error', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('PowerShell failed'); });

    const result = showOpenFileDialog({ filter: 'video' });

    expect(result).toBeNull();
  });

  it('calls execSync with powershell command containing the title', () => {
    vi.mocked(execSync).mockReturnValue('');

    showOpenFileDialog({ title: 'My Title', filter: 'video' });

    const call = vi.mocked(execSync).mock.calls[0];
    expect(call[0]).toContain('My Title');
    expect(call[0]).toContain('powershell');
  });

  it('uses video filter when filter is "video"', () => {
    vi.mocked(execSync).mockReturnValue('');

    showOpenFileDialog({ filter: 'video' });

    const cmd = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(cmd).toContain('*.mp4;*.webm;*.mkv;*.avi;*.mov');
  });

  it('uses transcript filter when filter is "transcript"', () => {
    vi.mocked(execSync).mockReturnValue('');

    showOpenFileDialog({ filter: 'transcript' });

    const cmd = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(cmd).toContain('*.vtt;*.srt');
  });

  it('uses default title and filter when no options are provided', () => {
    vi.mocked(execSync).mockReturnValue('');

    showOpenFileDialog();

    const cmd = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(cmd).toContain('Selecionar arquivo');
    expect(cmd).toContain('All Files');
  });

  it('sets timeout to 120 seconds', () => {
    vi.mocked(execSync).mockReturnValue('');

    showOpenFileDialog();

    const opts = vi.mocked(execSync).mock.calls[0][1] as { timeout: number };
    expect(opts.timeout).toBe(120_000);
  });
});
