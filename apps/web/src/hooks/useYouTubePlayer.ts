import { useEffect, useRef, useState, useCallback } from 'react';

// Minimal YT IFrame API types
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

const YT_SCRIPT_ID = 'yt-iframe-api';

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };

    if (!document.getElementById(YT_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = YT_SCRIPT_ID;
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });
}

export function useYouTubePlayer(videoId: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await loadYTApi();
      if (cancelled || !containerRef.current) return;

      // Create a fresh child element — YT.Player replaces the target element
      // with an iframe, so we can't reuse containerRef directly.
      const playerEl = document.createElement('div');
      playerEl.style.width = '100%';
      playerEl.style.height = '100%';
      containerRef.current.appendChild(playerEl);

      playerRef.current = new window.YT.Player(playerEl, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setDurationMs(Math.round(e.target.getDuration() * 1000));
            setReady(true);
            intervalRef.current = setInterval(() => {
              if (!playerRef.current) return;
              setCurrentTimeMs(Math.round(playerRef.current.getCurrentTime() * 1000));
              const dur = playerRef.current.getDuration();
              if (dur > 0) setDurationMs(Math.round(dur * 1000));
            }, 80);
          },
          onStateChange: (e) => {
            if (cancelled) return;
            setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    };

    init();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
      // Clear the container so a fresh child can be created on re-init
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setReady(false);
      setCurrentTimeMs(0);
      setDurationMs(0);
      setIsPlaying(false);
    };
  }, [videoId]);

  const seek = useCallback((ms: number) => {
    playerRef.current?.seekTo(ms / 1000, true);
    setCurrentTimeMs(ms);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT?.PlayerState?.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, []);

  return { containerRef, currentTimeMs, durationMs, isPlaying, ready, seek, togglePlay };
}
