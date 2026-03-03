import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Dual-element audio sync hook.
 *
 * Uses a muted <video> for display and a hidden <audio> for sound,
 * both from the same source URL. Adjusting `offsetMs` shifts the audio
 * relative to the video in real time — no server round-trip needed.
 *
 * The playback range is clamped to [rangeStartSec, rangeEndSec] so the
 * user only sees the selected cut (not the padding).
 *
 * All values read inside the RAF loop are stored in refs so the tick
 * callback stays referentially stable and never breaks the animation chain.
 */
export function useAudioSync(
  streamUrl: string,
  paddingBeforeMs: number,
  originalDurationMs: number,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const playingRef = useRef(false);
  const offsetRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [offsetMs, setOffsetMsState] = useState(0);

  const rangeStartSec = paddingBeforeMs / 1000;
  const rangeEndSec = (paddingBeforeMs + originalDurationMs) / 1000;

  // Keep range values in refs so the tick closure never goes stale
  const rangeStartRef = useRef(rangeStartSec);
  const rangeEndRef = useRef(rangeEndSec);
  rangeStartRef.current = rangeStartSec;
  rangeEndRef.current = rangeEndSec;

  const setOffsetMs = useCallback((ms: number) => {
    offsetRef.current = ms;
    setOffsetMsState(ms);
    // Re-sync audio immediately
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && audio) {
      const target = video.currentTime - ms / 1000;
      audio.currentTime = Math.max(0, target);
    }
  }, []);

  // Sync audio position to video + offset (reads from refs only)
  const syncAudio = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const targetAudioTime = video.currentTime - offsetRef.current / 1000;
    if (Math.abs(audio.currentTime - targetAudioTime) > 0.1) {
      audio.currentTime = Math.max(0, targetAudioTime);
    }
  }, []);

  // Stable RAF tick — all external values come from refs
  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      if (playingRef.current) rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const rStart = rangeStartRef.current;
    const rEnd = rangeEndRef.current;

    // Clamp to range end
    if (video.currentTime >= rEnd) {
      video.pause();
      audioRef.current?.pause();
      playingRef.current = false;
      setIsPlaying(false);
      video.currentTime = rEnd;
      setCurrentTimeMs((rEnd - rStart) * 1000);
      return; // stop loop
    }

    // Update displayed time (relative to range start)
    setCurrentTimeMs((video.currentTime - rStart) * 1000);
    syncAudio();

    if (playingRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [syncAudio]);

  // Start/stop the RAF loop
  useEffect(() => {
    if (isPlaying) {
      playingRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      playingRef.current = false;
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  // Initialize video position to range start when src loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      video.currentTime = rangeStartSec;
      setCurrentTimeMs(0);
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [streamUrl, rangeStartSec]);

  const play = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    // If at end, restart from beginning of range
    if (video.currentTime >= rangeEndRef.current - 0.1) {
      video.currentTime = rangeStartRef.current;
    }

    syncAudio();
    video.play().catch(() => {});
    audio.play().catch(() => {});
    playingRef.current = true;
    setIsPlaying(true);
  }, [syncAudio]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    playingRef.current ? pause() : play();
  }, [play, pause]);

  const seek = useCallback((ms: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(ms, originalDurationMs));
    video.currentTime = rangeStartRef.current + clamped / 1000;
    syncAudio();
    setCurrentTimeMs(clamped);
  }, [originalDurationMs, syncAudio]);

  return {
    videoRef,
    audioRef,
    isPlaying,
    currentTimeMs,
    durationMs: originalDurationMs,
    offsetMs,
    setOffsetMs,
    play,
    pause,
    togglePlay,
    seek,
  };
}
