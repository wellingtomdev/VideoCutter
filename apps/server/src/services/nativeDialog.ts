import { execSync } from 'child_process';

const FILTERS: Record<string, string> = {
  video: 'Video Files|*.mp4;*.webm;*.mkv;*.avi;*.mov|All Files|*.*',
  transcript: 'Transcript Files|*.vtt;*.srt|All Files|*.*',
  all: 'All Files|*.*',
};

export function showOpenFileDialog(options?: { title?: string; filter?: string }): string | null {
  const title = options?.title ?? 'Selecionar arquivo';
  const filter = FILTERS[options?.filter ?? 'all'] ?? FILTERS.all;

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = '${title.replace(/'/g, "''")}'
$d.Filter = '${filter.replace(/'/g, "''")}'
$d.Multiselect = $false
if ($d.ShowDialog() -eq 'OK') { $d.FileName } else { '' }
`.trim();

  try {
    const result = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 120_000,
      windowsHide: false,
    }).trim();

    return result || null;
  } catch {
    return null;
  }
}
