import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../services/api';

export function useLocalPlayer(videoPath: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!videoPath || !containerRef.current) {
      setReady(false);
      setCurrentTimeMs(0);
      setDurationMs(0);
      setIsPlaying(false);
      return;
    }

    // Create video element inside the container
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.maxHeight = '50vh';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.src = api.streamUrl(videoPath);

    videoRef.current = video;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(video);

    const onLoadedMetadata = () => {
      setDurationMs(Math.round(video.duration * 1000));
      setReady(true);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    // Poll current time (same interval as YouTube hook)
    intervalRef.current = setInterval(() => {
      if (videoRef.current) {
        setCurrentTimeMs(Math.round(videoRef.current.currentTime * 1000));
      }
    }, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.pause();
      video.src = '';
      videoRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setReady(false);
      setCurrentTimeMs(0);
      setDurationMs(0);
      setIsPlaying(false);
    };
  }, [videoPath]);

  const seek = useCallback((ms: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ms / 1000;
      setCurrentTimeMs(ms);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  return { containerRef, currentTimeMs, durationMs, isPlaying, ready, seek, togglePlay };
}
