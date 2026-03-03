import React from 'react';
import { Controls } from './Controls';
import { api } from '../../services/api';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
}

export function VideoPlayer({
  videoRef,
  src,
  currentTimeMs,
  durationMs,
  isPlaying,
  onTogglePlay,
  onSeek,
}: VideoPlayerProps) {
  const streamSrc = api.streamUrl(src);

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={streamSrc}
        className="w-full max-h-[50vh] object-contain"
        controls={false}
      />
      <Controls
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
      />
    </div>
  );
}
