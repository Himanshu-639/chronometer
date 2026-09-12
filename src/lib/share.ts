// ─── Share Text Generator ─────────────────────────────────────────────────────

import { buildShareGrid } from './scoring';
import { getPuzzleLabel } from './puzzle';

export interface ShareData {
  puzzleId: number;
  guessedYear: number;
  answerYear: number;
  totalScore: number;
  usedSpectrogram: boolean;
}

/**
 * Generates a Wordle-style shareable text for clipboard / social.
 *
 * Example output:
 *   🎙️ Acoustic Chronometer #284
 *   📅 1978 → 1963 (15 years off)
 *   🟥🟥🟨🟩🟩  Score: 500
 *   🔬 Used spectrogram
 *   acousticchronometer.io
 */
export function generateShareText(data: ShareData): string {
  const { puzzleId, guessedYear, answerYear, totalScore, usedSpectrogram } = data;
  const delta = Math.abs(guessedYear - answerYear);
  const grid = buildShareGrid(delta);
  const deltaStr = delta === 0 ? 'Spot on!' : `${delta} year${delta !== 1 ? 's' : ''} off`;

  const lines = [
    `🎙️ Acoustic Chronometer ${getPuzzleLabel(puzzleId)}`,
    `📅 Guessed ${guessedYear} → Actual ${answerYear} (${deltaStr})`,
    `${grid}  Score: ${totalScore.toLocaleString()}`,
    usedSpectrogram ? '🔬 Used spectrogram analysis' : '👂 Pure listening — no spectrogram',
    `https://acousticchronometer.vercel.app`,
  ];

  return lines.join('\n');
}

/**
 * Copies text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / non-HTTPS contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
