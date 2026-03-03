import { useRef, useState, useCallback, useEffect } from 'react';

export function useVideoTime() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  const updateTime = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTimeMs(Math.round(video.currentTime * 1000));
    }
    rafRef.current = requestAnimationFrame(updateTime);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDurationMs(Math.round(video.duration * 1000));
    };
    const onPlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateTime);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateTime]);

  const seek = useCallback((timeMs: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
    }
  }, []);

  const play = useCallback(() => videoRef.current?.play(), []);
  const pause = useCallback(() => videoRef.current?.pause(), []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  return { videoRef, currentTimeMs, durationMs, isPlaying, seek, play, pause, togglePlay };
}
