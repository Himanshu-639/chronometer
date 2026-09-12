// ─── Distance-Based Scoring Engine ──────────────────────────────────────────
// Mirrors GeoGuessr's approach: partial credit based on how close you are.
// Answer is never sent to client — scoring is validated server-side.

import type { ScoreResult, ScoreLabel } from '@/types/puzzle';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BASE_SCORE = 1000;
const SPECTROGRAM_BONUS = 200; // awarded if spectrogram was NOT opened (pure listening)

/**
 * Scoring tiers based on absolute year delta.
 *
 * |delta| → base score
 *   0       → 1000  (Perfect)
 *   1–5     → 750   (Excellent)
 *   6–10    → 500   (Good)
 *   11–15   → 250   (Close)
 *   16–20   → 100   (Off-track)
 *   21+     → 25    (consolation)
 */
const TIERS: { maxDelta: number; score: number; label: ScoreLabel }[] = [
  { maxDelta: 0,  score: 1000, label: 'Perfect' },
  { maxDelta: 5,  score: 750,  label: 'Excellent' },
  { maxDelta: 10, score: 500,  label: 'Good' },
  { maxDelta: 15, score: 250,  label: 'Close' },
  { maxDelta: 20, score: 100,  label: 'Off-track' },
  { maxDelta: Infinity, score: 25, label: 'Off-track' },
];

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Calculate the score for a single guess.
 *
 * @param guessedYear     The year the player selected on the slider
 * @param answerYear      The true year of the recording (server-side only)
 * @param usedSpectrogram Whether the player opened analysis mode
 * @returns               Full ScoreResult breakdown
 */
export function calculateScore(
  guessedYear: number,
  answerYear: number,
  usedSpectrogram: boolean,
): ScoreResult {
  const delta = Math.abs(guessedYear - answerYear);

  const tier = TIERS.find((t) => delta <= t.maxDelta)!;
  const baseScore = tier.score;
  const spectrogramBonus = !usedSpectrogram ? SPECTROGRAM_BONUS : 0;

  return {
    baseScore,
    spectrogramBonus,
    totalScore: Math.min(baseScore + spectrogramBonus, MAX_BASE_SCORE + SPECTROGRAM_BONUS),
    label: tier.label,
  };
}

/**
 * Generates the emoji grid for the share text.
 * 🟩 = ±0   🟨 = ±5-10   🟥 = ±15+
 */
export function buildShareGrid(delta: number): string {
  if (delta === 0) return '🟩🟩🟩🟩🟩';
  if (delta <= 5)  return '🟨🟩🟩🟩🟩';
  if (delta <= 10) return '🟥🟨🟩🟩🟩';
  if (delta <= 15) return '🟥🟥🟨🟩🟩';
  if (delta <= 20) return '🟥🟥🟥🟨🟩';
  return '🟥🟥🟥🟥🟥';
}

/**
 * Returns a human-friendly label for how far off the guess was.
 */
export function deltaLabel(delta: number): string {
  if (delta === 0) return 'Spot on!';
  if (delta === 1) return '1 year off';
  return `${delta} years off`;
}
