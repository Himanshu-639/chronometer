// ─── Daily Puzzle Seeding ────────────────────────────────────────────────────
// Deterministic date-based puzzle ID — same as Wordle's approach.
// No server call needed to know which puzzle is "today's".

const EPOCH = new Date('2024-01-01T00:00:00.000Z');

/**
 * Returns the zero-based puzzle index for today.
 * Puzzle #0 = Jan 1, 2024; Puzzle #1 = Jan 2, 2024; etc.
 */
export function getTodaysPuzzleId(): number {
  const now = new Date();
  // Normalise to midnight local time to avoid timezone drift across day boundary
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epochDay = new Date(
    EPOCH.getFullYear(),
    EPOCH.getMonth(),
    EPOCH.getDate(),
  );
  return Math.floor((today.getTime() - epochDay.getTime()) / 86_400_000);
}

/**
 * Returns the ISO date string for today (YYYY-MM-DD) in local time.
 */
export function getTodaysDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a formatted display label for the puzzle number, e.g. "#284".
 */
export function getPuzzleLabel(puzzleId: number): string {
  return `#${puzzleId + 1}`;
}

/**
 * Returns hours, minutes, seconds remaining until midnight local time.
 */
export function getTimeUntilMidnight(): { hours: string; minutes: string; seconds: string } {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diff = Math.max(0, midnight.getTime() - now.getTime());

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
}
