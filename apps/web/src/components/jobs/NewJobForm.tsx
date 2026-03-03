import { useState } from 'react';
import { useJobs } from '../../contexts/JobsContext';
import { api } from '../../services/api';
import type { TranscriptSegment } from '../../types';

interface NewJobFormProps {
  onCreated: () => void;
}

type SourceMode = 'youtube' | 'local';

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

export function NewJobForm({ onCreated }: NewJobFormProps) {
  const { createJob } = useJobs();
  const [sourceMode, setSourceMode] = useState<SourceMode>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TAB = 'px-2 py-1 text-xs rounded transition-colors font-medium';
  const ACTIVE = 'bg-gray-600 text-white';
  const INACTIVE = 'text-gray-400 hover:text-gray-200';

  const handlePickVideo = async () => {
    try {
      const path = await api.openFileDialog('video', 'Selecionar video');
      if (path) setLocalPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let transcript: TranscriptSegment[] | undefined;

      if (sourceMode === 'youtube') {
        const videoId = extractYoutubeId(youtubeUrl.trim());
        if (!videoId) {
          setError('URL do YouTube invalida');
          setLoading(false);
          return;
        }

        // Try to fetch transcript
        try {
          transcript = await api.youtubeTranscript(youtubeUrl.trim());
        } catch {
          // Transcript is optional
        }

        await createJob({
          source: { type: 'youtube', youtubeUrl: youtubeUrl.trim(), videoId },
          transcript,
        });
      } else {
        if (!localPath) {
          setError('Selecione um arquivo de video');
          setLoading(false);
          return;
        }

        await createJob({
          source: { type: 'local', path: localPath },
        });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2.5">
      {/* Source mode toggle */}
      <div className="flex gap-1 bg-gray-900/50 rounded p-0.5">
        <button type="button" onClick={() => setSourceMode('youtube')}
          className={`${TAB} flex-1 ${sourceMode === 'youtube' ? ACTIVE : INACTIVE}`}>
          YouTube
        </button>
        <button type="button" onClick={() => setSourceMode('local')}
          className={`${TAB} flex-1 ${sourceMode === 'local' ? ACTIVE : INACTIVE}`}>
          Arquivo Local
        </button>
      </div>

      {/* YouTube URL */}
      {sourceMode === 'youtube' && (
        <input
          type="text"
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full bg-gray-700 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      )}

      {/* Local file picker */}
      {sourceMode === 'local' && (
        <button
          type="button"
          onClick={handlePickVideo}
          className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition-colors truncate ${
            localPath
              ? 'border-green-700 bg-green-900/20 text-green-400'
              : 'border-dashed border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
          }`}
        >
          {localPath ? basename(localPath) : 'Selecionar video...'}
        </button>
      )}

      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 rounded transition-colors"
      >
        {loading ? 'Criando...' : 'Criar Trabalho'}
      </button>
    </form>
  );
}
