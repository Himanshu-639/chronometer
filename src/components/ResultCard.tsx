'use client';

// ─── Result Card ──────────────────────────────────────────────────────────────
// Shown after guess is submitted. Animates score counter, reveals answer,
// shows curator note, and provides one-click share.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { generateShareText, copyToClipboard } from '@/lib/share';
import { deltaLabel } from '@/lib/scoring';
import { getEraContext } from '@/lib/clue-engine';
import type { ScoreResult } from '@/types/puzzle';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ResultCardProps {
  puzzleId: number;
  guessedYear: number;
  answerYear: number;
  answerDecade: string;
  curatorNote: string;
  source: string;
  score: ScoreResult;
  usedSpectrogram: boolean;
  onPlayAgainTomorrow?: () => void;
  onNextSample?: () => void;
  onRandomSample?: () => void;
  sampleNumber?: number;
  totalSamples?: number;
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
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
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
  onPlayAgainTomorrow,
  onNextSample,
  onRandomSample,
  sampleNumber,
  totalSamples = 30,
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
          Signal Solved
        </span>
        <span className="text-xs font-bold" style={{ color: '#39ff14' }}>
          Sample #{sampleNumber ?? puzzleId + 1} of {totalSamples}
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

        {/* Actions */}
        <div className="space-y-3">
          {onNextSample && (
            <button
              onClick={onNextSample}
              className="w-full py-3.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(57,255,20,0.18)',
                color: '#39ff14',
                border: '2px solid #39ff14',
                boxShadow: '0 0 16px rgba(57,255,20,0.25)',
              }}
            >
              ▶ Test Next Audio Sample ({((sampleNumber ?? 1) % totalSamples) + 1}/{totalSamples})
            </button>
          )}

          <div className="flex gap-3">
            {onRandomSample && (
              <button
                onClick={onRandomSample}
                className="flex-1 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: '#13131f',
                  color: '#e8e8f0',
                  border: '1px solid #2a2a40',
                }}
              >
                🎲 Random Sample
              </button>
            )}

            <button
              onClick={handleShare}
              className="flex-1 py-3 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: copied ? 'rgba(57,255,20,0.2)' : 'rgba(57,255,20,0.08)',
                color: '#39ff14',
                border: '1px solid rgba(57,255,20,0.2)',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Share Result'}
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
