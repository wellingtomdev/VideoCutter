import { useYouTubePlayer } from './useYouTubePlayer';
import { useLocalPlayer } from './useLocalPlayer';
import type { JobSource } from '../types';

export interface PlayerState {
  containerRef: React.RefObject<HTMLDivElement>;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  ready: boolean;
  seek: (ms: number) => void;
  togglePlay: () => void;
}

/**
 * Unified player hook — delegates to useYouTubePlayer or useLocalPlayer
 * depending on the job source type. Both hooks are always called (React rules)
 * but only the active one initialises (via guards on empty videoId / videoPath).
 */
export function usePlayer(source: JobSource): PlayerState & { type: 'youtube' | 'local' } {
  const videoId = source.type === 'youtube' ? (source.videoId ?? '') : '';
  const videoPath = source.type === 'local' ? (source.path ?? '') : '';

  const yt = useYouTubePlayer(videoId);
  const local = useLocalPlayer(videoPath);

  if (source.type === 'youtube') {
    return { ...yt, type: 'youtube' };
  }
  return { ...local, type: 'local' };
}
