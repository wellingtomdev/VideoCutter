export async function downloadFile(url: string, suggestedName: string): Promise<void> {
  // Try File System Access API for native "Save As" dialog
  if ('showSaveFilePicker' in window) {
    try {
      const ext = suggestedName.includes('.') ? suggestedName.slice(suggestedName.lastIndexOf('.')) : '.mp4';
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'Video file',
          accept: { 'video/*': [ext] },
        }],
      });

      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const writable = await handle.createWritable();
      await response.body.pipeTo(writable);
      return;
    } catch (err: unknown) {
      // User cancelled the dialog
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fall through to legacy download
    }
  }

  // Fallback: create a temporary <a download> link
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
