// ─── Acoustic Chronometer — Type Definitions ────────────────────────────────

export interface Puzzle {
  id: number;
  puzzleDate: string;           // ISO date string "YYYY-MM-DD"
  audioUrl: string;             // Direct URL to source audio (Freesound, Internet Archive, etc.)
  audioStartOffset: number;     // Seconds into the file where the 5-second window starts
  region: string;               // "EU/Asia (50Hz)" | "Americas (60Hz)"
  difficulty: PuzzleDifficulty;
  clues: [string, string, string];  // Always exactly 3 clues, unlocked progressively
  totalPuzzles?: number;        // Total available samples in database/manifest
}

/** What the server reveals only AFTER a guess is submitted */
export interface PuzzleAnswer {
  answerYear: number;         // e.g. 1978
  answerDecade: string;       // e.g. "1970s"
  curatorNote: string;        // Human-readable context shown post-reveal
  source: string;             // Attribution for the audio clip
}

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

// ─── Guess & Scoring ─────────────────────────────────────────────────────────

export interface Guess {
  guessedYear: number;
  score: number;
  deltaYears: number;         // |guessedYear - answerYear|
  timestamp: number;          // ms since epoch
}

export interface GameState {
  puzzleId: number;
  guesses: Guess[];
  cluesUnlocked: number;      // 0 | 1 | 2 | 3
  isComplete: boolean;
  usedSpectrogram: boolean;   // tracks whether analysis mode was opened
  startedAt: number;          // ms since epoch
}

export interface ScoreResult {
  baseScore: number;
  spectrogramBonus: number;
  totalScore: number;
  label: ScoreLabel;
}

export type ScoreLabel =
  | 'Perfect'       // exact year
  | 'Excellent'     // ±5 years
  | 'Good'          // ±10 years
  | 'Close'         // ±15 years
  | 'Off-track';    // ±20+ years

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  deviceId: string;           // anonymised
  displayName: string;        // e.g. "Player #4712"
  finalScore: number;
  timeTaken: number;          // seconds
}

// ─── Spectrogram ─────────────────────────────────────────────────────────────

export interface FrequencyAnnotation {
  freqHz: number;
  label: string;
  eraContext: string;
  color: string;              // Tailwind class or hex
}

export interface SpectrogramConfig {
  fftSize: 2048 | 4096 | 8192;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
}
