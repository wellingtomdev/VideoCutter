import { useState } from 'react';
import { api } from '../../services/api';
import type { TranscriptSegment } from '../../types';

interface FileSetupProps {
  onReady: (data: { youtubeUrl: string; videoId: string; segments: TranscriptSegment[] }) => void;
}

type TranscriptMode = 'youtube' | 'file' | 'paste';

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

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

export function FileSetup({ onReady }: FileSetupProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('youtube');
  const [transcriptPath, setTranscriptPath] = useState('');
  const [pastedText, setPastedText] = useState('');

  const [ytSegments, setYtSegments] = useState<TranscriptSegment[] | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYoutubeTranscript = async (url: string) => {
    if (!url.trim()) return;
    setYtLoading(true);
    setYtError(null);
    setYtSegments(null);
    try {
      const segs = await api.youtubeTranscript(url.trim());
      setYtSegments(segs);
    } catch (err) {
      setYtError(err instanceof Error ? err.message : String(err));
    } finally {
      setYtLoading(false);
    }
  };

  const handlePickTranscript = async () => {
    try {
      const path = await api.openFileDialog('transcript', 'Selecionar Transcrição');
      if (path) setTranscriptPath(path);
    } catch {
      // user cancelled or error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const videoId = extractYoutubeId(youtubeUrl.trim());
    if (!videoId) {
      setError('URL do YouTube invalida. Use o formato https://youtube.com/watch?v=ID');
      return;
    }

    setLoading(true);
    try {
      let segments: TranscriptSegment[];

      if (transcriptMode === 'youtube') {
        if (ytSegments) {
          segments = ytSegments;
        } else {
          segments = await api.youtubeTranscript(youtubeUrl.trim());
        }
      } else if (transcriptMode === 'file') {
        segments = transcriptPath ? await api.parseTranscript(transcriptPath) : [];
      } else {
        segments = pastedText.trim() ? await api.parseTranscriptRaw(pastedText) : [];
      }

      onReady({ youtubeUrl: youtubeUrl.trim(), videoId, segments });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode: TranscriptMode) => {
    setTranscriptMode(mode);
    setYtError(null);
    setError(null);
  };

  const urlIsValid = !!extractYoutubeId(youtubeUrl.trim());

  const TAB = 'px-3 py-1.5 text-sm rounded-md transition-colors font-medium';
  const ACTIVE = 'bg-gray-700 text-white';
  const INACTIVE = 'text-gray-400 hover:text-gray-200';

  return (
    <div className="bg-gray-800 rounded-xl p-8 w-full max-w-lg shadow-2xl">
      <h2 className="text-2xl font-bold mb-2 text-center">Video Cutter</h2>
      <p className="text-gray-400 text-sm mb-8 text-center">
        Insira o link do video no YouTube para comecar
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* YouTube URL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Link do Video
          </label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              setYtSegments(null);
              setYtError(null);
            }}
            placeholder="https://youtube.com/watch?v=..."
            className={`w-full bg-gray-700 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500
              focus:outline-none focus:border-blue-500 transition-colors
              ${urlIsValid ? 'border-green-600' : 'border-gray-600'}`}
          />
          {urlIsValid && (
            <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              URL valida
            </p>
          )}
        </div>

        {/* Transcrição source */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Transcrição <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1">
              <button type="button" onClick={() => switchMode('youtube')}
                className={`${TAB} ${transcriptMode === 'youtube' ? ACTIVE : INACTIVE}`}>
                YouTube
              </button>
              <button type="button" onClick={() => switchMode('file')}
                className={`${TAB} ${transcriptMode === 'file' ? ACTIVE : INACTIVE}`}>
                Arquivo
              </button>
              <button type="button" onClick={() => switchMode('paste')}
                className={`${TAB} ${transcriptMode === 'paste' ? ACTIVE : INACTIVE}`}>
                Colar
              </button>
            </div>
          </div>

          {/* YouTube transcript tab */}
          {transcriptMode === 'youtube' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-400 italic">
                  Sera buscada automaticamente do link acima
                </div>
                <button
                  type="button"
                  onClick={() => fetchYoutubeTranscript(youtubeUrl)}
                  disabled={ytLoading || !urlIsValid}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0"
                >
                  {ytLoading ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                  ) : 'Pre-buscar'}
                </button>
              </div>
              {ytError && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-2 py-1">
                  {ytError}
                </p>
              )}
              {ytSegments && (
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {ytSegments.length} segmentos carregados
                </p>
              )}
            </div>
          )}

          {/* File tab */}
          {transcriptMode === 'file' && (
            <button
              type="button"
              onClick={handlePickTranscript}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors text-left
                ${transcriptPath
                  ? 'border-blue-600 bg-blue-900/20 hover:border-blue-500'
                  : 'border-gray-600 bg-gray-700/50 hover:border-blue-500 hover:bg-gray-700'
                }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                className={`w-6 h-6 shrink-0 ${transcriptPath ? 'text-blue-400' : 'text-gray-400'}`}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 overflow-hidden">
                {transcriptPath ? (
                  <>
                    <p className="text-sm font-medium text-blue-400 truncate">{basename(transcriptPath)}</p>
                    <p className="text-xs text-gray-500 truncate">{transcriptPath}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Clique para selecionar .vtt ou .srt...</p>
                )}
              </div>
              {transcriptPath && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setTranscriptPath(''); }}
                  className="text-gray-500 hover:text-gray-300 shrink-0 p-0.5"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </button>
          )}

          {/* Paste tab */}
          {transcriptMode === 'paste' && (
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Cole a Transcrição aqui. Formatos aceitos:\n\n• VTT / SRT (com timestamps)\n• Texto do YouTube (0:00 / linha de texto)`}
              rows={6}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !urlIsValid}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Carregando...' : 'Abrir no Editor'}
        </button>
      </form>
    </div>
  );
}
