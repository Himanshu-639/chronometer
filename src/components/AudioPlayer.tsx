'use client';

// ─── Audio Player ─────────────────────────────────────────────────────────────
// Play/pause control with replay counter (max 3).
// Handles iOS Safari audio context unlock requirement.

import { useState, useRef, useCallback, useEffect } from 'react';
import { getAudioContext, playAudio } from '@/lib/audio-analysis';
import type { PlaybackHandle } from '@/lib/audio-analysis';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AudioPlayerProps {
  audioBuffer: AudioBuffer | null;
  maxReplays?: number;
  onAnalyserReady?: (analyser: AnalyserNode | null) => void;
  onPlaybackEnd?: () => void;
  onReplayCountChange?: (count: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioPlayer({
  audioBuffer,
  maxReplays = 3,
  onAnalyserReady,
  onPlaybackEnd,
  onReplayCountChange,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [progress, setProgress] = useState(0);   // 0–1
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(5);

  const isExhausted = replayCount >= maxReplays;

  // ── Stop current playback ─────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    onAnalyserReady?.(null);
    setIsPlaying(false);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, [onAnalyserReady]);

  // ── Start playback ────────────────────────────────────────────────────────

  const startPlayback = useCallback(() => {
    if (!audioBuffer || isExhausted) return;

    // iOS Safari: resume AudioContext inside user gesture
    try { getAudioContext().resume(); } catch { /* ignore */ }

    const newCount = replayCount + 1;
    setReplayCount(newCount);
    onReplayCountChange?.(newCount);

    durationRef.current = audioBuffer.duration;
    startTimeRef.current = Date.now();
    setProgress(0);

    const handle = playAudio(audioBuffer, undefined, () => {
      setIsPlaying(false);
      setProgress(1);
      onAnalyserReady?.(null);
      onPlaybackEnd?.();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    });

    playbackRef.current = handle;
    onAnalyserReady?.(handle.analyser);
    setIsPlaying(true);

    // Progress tracking
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setProgress(Math.min(elapsed / durationRef.current, 1));
    }, 50);
  }, [audioBuffer, isExhausted, replayCount, onAnalyserReady, onPlaybackEnd, onReplayCountChange]);

  // ── Toggle ────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // ── Replay dots ───────────────────────────────────────────────────────────

  const dots = Array.from({ length: maxReplays }, (_, i) => i < replayCount);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4">

      {/* Play / Pause Button */}
      <div className="relative">
        {/* Pulse ring when playing */}
        {isPlaying && (
          <span
            className="absolute inset-0 rounded-full pulse-ring"
            style={{ border: '2px solid #39ff14' }}
          />
        )}
        <button
          onClick={handleToggle}
          disabled={!audioBuffer || isExhausted}
          aria-label={isPlaying ? 'Pause' : 'Play clip'}
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isPlaying ? 'rgba(57,255,20,0.12)' : 'rgba(57,255,20,0.08)',
            border: '2px solid',
            borderColor: isExhausted ? '#444466' : '#39ff14',
            boxShadow: isPlaying ? '0 0 20px rgba(57,255,20,0.3)' : 'none',
          }}
        >
          {isPlaying ? (
            // Pause icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#39ff14">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#39ff14">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1e1e30' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: '#39ff14',
            boxShadow: '0 0 6px #39ff14',
            transitionDuration: isPlaying ? '50ms' : '0ms',
          }}
        />
      </div>

      {/* Replay dots */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#444466]">plays</span>
        <div className="flex gap-1.5">
          {dots.map((used, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: used ? '#39ff14' : '#1e1e30',
                boxShadow: used ? '0 0 4px #39ff14' : 'none',
              }}
            />
          ))}
        </div>
        {isExhausted && (
          <span className="text-xs" style={{ color: '#ff3860' }}>
            limit reached
          </span>
        )}
      </div>

      {/* Status label */}
      <p className="text-xs" style={{ color: '#8888aa' }}>
        {!audioBuffer
          ? 'Loading audio…'
          : isExhausted
          ? 'No more plays — make your guess!'
          : isPlaying
          ? 'Listening…'
          : replayCount === 0
          ? 'Press play to begin'
          : `${maxReplays - replayCount} play${maxReplays - replayCount !== 1 ? 's' : ''} remaining`}
      </p>
    </div>
  );
}
