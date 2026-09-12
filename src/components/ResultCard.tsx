'use client';

// ─── Result Card (Daily Mode) ────────────────────────────────────────────────
// Displays player score, delta, acoustic context, curator note,
// live countdown timer until tomorrow's puzzle, and share actions.

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { generateShareText, copyToClipboard } from '@/lib/share';
import { deltaLabel } from '@/lib/scoring';
import { getEraContext } from '@/lib/clue-engine';
import { getTimeUntilMidnight } from '@/lib/puzzle';
import type { ScoreResult } from '@/types/puzzle';

interface ResultCardProps {
  puzzleId: number;
  guessedYear: number;
  answerYear: number;
  answerDecade: string;
  curatorNote: string;
  source: string;
  score: ScoreResult;
  usedSpectrogram: boolean;
  onHomeClick?: () => void;
}

// ── Score Ticker ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

// ── Live Countdown to Midnight ───────────────────────────────────────────────

function CountdownTimer() {
  const [time, setTime] = useState({ hours: '00', minutes: '00', seconds: '00' });

  useEffect(() => {
    setTime(getTimeUntilMidnight());
    const interval = setInterval(() => {
      setTime(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="p-4 rounded-xl text-center"
      style={{ backgroundColor: '#080810', border: '1px solid #1e1e30' }}
    >
      <div className="text-[11px] uppercase tracking-widest text-[#8888aa] mb-1 flex items-center justify-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
        Next Daily Signal In
      </div>
      <div className="text-2xl font-mono font-bold text-[#e8e8f0] tracking-wider">
        {time.hours}:{time.minutes}:{time.seconds}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultCard({
  puzzleId,
  guessedYear,
  answerYear,
  answerDecade,
  curatorNote,
  source,
  score,
  usedSpectrogram,
  onHomeClick,
}: ResultCardProps) {
  const delta = Math.abs(guessedYear - answerYear);
  const displayScore = useCountUp(score.totalScore);
  const [copied, setCopied] = useState(false);

  const isExact = delta === 0;
  const labelColor = isExact ? '#39ff14' : delta <= 10 ? '#ffb347' : '#ff3860';

  const handleShare = async () => {
    const text = generateShareText({
      puzzleId,
      guessedYear,
      answerYear,
      totalScore: score.totalScore,
      usedSpectrogram,
    });
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto rounded-xl overflow-hidden"
      style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
    >
      {/* Header bar */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: '#13131f', borderBottom: '1px solid #1e1e30' }}
      >
        <span className="text-xs uppercase tracking-widest" style={{ color: '#8888aa' }}>
          Today's Result
        </span>
        <span className="text-xs font-bold" style={{ color: '#39ff14' }}>
          Signal #{puzzleId + 1}
        </span>
      </div>

      <div className="p-6 space-y-6">

        {/* Score */}
        <div className="text-center">
          <div
            className="text-6xl font-bold tabular-nums"
            style={{
              color: labelColor,
              textShadow: `0 0 20px ${labelColor}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayScore.toLocaleString()}
          </div>
          <div className="mt-1 text-sm uppercase tracking-widest" style={{ color: labelColor }}>
            {score.label}
          </div>
          {score.spectrogramBonus > 0 && (
            <div className="mt-1 text-xs" style={{ color: '#8888aa' }}>
              + {score.spectrogramBonus} pure-listening bonus
            </div>
          )}
        </div>

        {/* Guess vs Answer */}
        <div
          className="flex items-center justify-center gap-4 p-4 rounded-lg"
          style={{ backgroundColor: '#080810' }}
        >
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#8888aa' }}>Your Guess</div>
            <div className="text-2xl font-bold" style={{ color: '#e8e8f0' }}>{guessedYear}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs" style={{ color: '#444466' }}>→</div>
            <div
              className="text-xs mt-1 px-2 py-0.5 rounded"
              style={{ color: labelColor, backgroundColor: `${labelColor}20` }}
            >
              {deltaLabel(delta)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#8888aa' }}>Actual Year</div>
            <div className="text-2xl font-bold" style={{ color: '#39ff14' }}>{answerYear}</div>
          </div>
        </div>

        {/* Era context */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: '#080810', border: '1px solid #1e1e30' }}
        >
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#39ff14' }}>
            {answerDecade} · Acoustic Context
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#8888aa' }}>
            {getEraContext(answerYear)}
          </p>
        </div>

        {/* Curator note */}
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#444466' }}>
            Curator's Note
          </div>
          <p className="text-sm leading-relaxed italic" style={{ color: '#8888aa' }}>
            "{curatorNote}"
          </p>
          <p className="text-xs mt-2" style={{ color: '#2a2a40' }}>
            Source: {source}
          </p>
        </div>

        {/* Next Signal Countdown */}
        <CountdownTimer />

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: copied ? 'rgba(57,255,20,0.25)' : 'rgba(57,255,20,0.15)',
              color: '#39ff14',
              border: '2px solid #39ff14',
              boxShadow: '0 0 16px rgba(57,255,20,0.2)',
            }}
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Share Result'}
          </button>

          {onHomeClick && (
            <button
              onClick={onHomeClick}
              className="px-4 py-3.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: '#13131f',
                color: '#8888aa',
                border: '1px solid #1e1e30',
              }}
            >
              ← Home
            </button>
          )}
        </div>

      </div>
    </motion.div>
  );
}
