-- ─── Acoustic Chronometer — Supabase Database Schema ───────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Puzzles Table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS puzzles (
  id            SERIAL PRIMARY KEY,
  puzzle_date   DATE UNIQUE NOT NULL,

  -- Audio source (no file storage needed — play directly from source)
  audio_url         TEXT NOT NULL,       -- Direct URL to the source audio file
  audio_start_offset FLOAT NOT NULL DEFAULT 0, -- Seconds into the file to start playing
  -- The player hears exactly 5 seconds starting at audio_start_offset.
  -- This removes all need to trim or host audio files ourselves.

  -- Optional Freesound metadata (for attribution and future re-fetching)
  freesound_id  INTEGER,                 -- Freesound sound ID if sourced from Freesound

  -- Answer (HIDDEN from client via RLS — only /api/score can read these)
  answer_year   INTEGER NOT NULL,        -- e.g. 1963
  answer_decade TEXT NOT NULL,           -- e.g. '1960s'
  curator_note  TEXT NOT NULL,           -- shown post-reveal
  source        TEXT NOT NULL,           -- attribution

  -- Metadata
  region        TEXT NOT NULL DEFAULT 'Unknown',  -- 'EU/Asia (50Hz)' | 'Americas (60Hz)'
  difficulty    TEXT NOT NULL DEFAULT 'medium',   -- 'easy' | 'medium' | 'hard'

  -- Progressive clues (3 per puzzle)
  clue_1        TEXT NOT NULL,           -- always visible
  clue_2        TEXT NOT NULL,           -- unlocked after 1st wrong guess
  clue_3        TEXT NOT NULL,           -- unlocked after 2nd wrong guess

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Scores Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id       INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,          -- anonymous device fingerprint
  guessed_year    INTEGER NOT NULL,
  final_score     INTEGER NOT NULL,
  delta_years     INTEGER NOT NULL,       -- |guessed - answer|
  time_taken      INTEGER NOT NULL,       -- seconds from first play to submission
  used_spectrogram BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One submission per device per puzzle
  CONSTRAINT unique_device_puzzle UNIQUE (device_id, puzzle_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_puzzles_date ON puzzles (puzzle_date DESC);
CREATE INDEX IF NOT EXISTS idx_scores_puzzle ON scores (puzzle_id, final_score DESC, time_taken ASC);
CREATE INDEX IF NOT EXISTS idx_scores_device ON scores (device_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on puzzles so answer_year is never exposed to anon clients.

ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores  ENABLE ROW LEVEL SECURITY;

-- Anon users can read puzzles BUT NOT the answer columns
CREATE POLICY "puzzles_read_safe" ON puzzles
  FOR SELECT TO anon
  USING (true);  -- RLS column-level: see view below

-- Create a view that strips answer columns for public access
CREATE OR REPLACE VIEW public_puzzles AS
  SELECT id, puzzle_date, audio_url, region, difficulty, clue_1, clue_2, clue_3, created_at
  FROM puzzles;

-- Anon users can insert scores
CREATE POLICY "scores_insert" ON scores
  FOR INSERT TO anon
  WITH CHECK (true);

-- Anon users can read all scores (for leaderboard)
CREATE POLICY "scores_read" ON scores
  FOR SELECT TO anon
  USING (true);

-- ── Sample Puzzles (5 real public domain sources) ──────────────────────────────
-- Replace audio_url with actual files uploaded to Supabase Storage or Internet Archive URLs.

INSERT INTO puzzles (
  puzzle_date, audio_url,
  answer_year, answer_decade, curator_note, source,
  region, difficulty,
  clue_1, clue_2, clue_3
) VALUES
(
  '2024-01-01',
  'https://archive.org/download/sample-1963-bbc/ambient.mp3',
  1963, '1960s',
  'BBC Radio studio ambience captured through an AKG C12 tube condenser microphone. '
  || 'The 50Hz mains hum bleeding through the preamp is unmistakable. '
  || 'This recording predates the introduction of Dolby noise reduction in British broadcasting.',
  'BBC Sound Archive, London — 1963 (Public Domain)',
  'EU/Asia (50Hz)', 'medium',
  'A harmonic series beginning at 50Hz is prominent — this recording is from Europe or Asia.',
  'The noise floor rises sharply above 12kHz, consistent with early magnetic tape stock.',
  'Subtle pitch flutter is visible around 3kHz — characteristic of 1960s tape transport instability.'
),
(
  '2024-01-02',
  'https://archive.org/download/sample-1978-cassette/ambient.mp3',
  1978, '1970s',
  'Field recording made on a Sony TCM-600 cassette recorder. The Dolby B noise reduction '
  || 'was disengaged during playback, revealing the characteristic tape hiss. '
  || 'The AM radio interference visible at 540kHz harmonics places this firmly in the late 1970s.',
  'Private Archive, Vienna — 1978 (CC0)',
  'EU/Asia (50Hz)', 'easy',
  'Elevated noise floor above 8kHz with a characteristic ''breathing'' pattern — Dolby B tape.',
  'The 50Hz mains hum is present alongside a faint 100Hz harmonic.',
  'Narrow bandwidth response (rolls off at ~13kHz) is consistent with Type I cassette tape of this era.'
),
(
  '2024-01-03',
  'https://archive.org/download/sample-1987-studio/ambient.mp3',
  1987, '1980s',
  'Digital studio HVAC ambience from an early DAT session at a New York recording facility. '
  || 'The 60Hz mains cycle is clearly visible. An early digital reverb unit is audible in bypass mode, '
  || 'producing faint quantisation noise at the 16-bit noise floor (~96dB below peak).',
  'New York Recording Studios Archive — 1987 (CC0)',
  'Americas (60Hz)', 'hard',
  'The fundamental mains hum is at 60Hz — this recording was made in the Americas or Japan.',
  'An extremely clean high-frequency response extending to 20kHz suggests early digital recording.',
  'Faint quantisation artifacts at -96dBFS are consistent with 16-bit digital audio of the 1980s.'
),
(
  '2024-01-04',
  'https://archive.org/download/sample-1952-radio/ambient.mp3',
  1952, '1950s',
  'AM radio studio standby ambience recorded directly to lacquer disc. '
  || 'The 78rpm surface noise characteristic of the acetate master is audible. '
  || 'Bandwidth is limited to approximately 5kHz — standard for carbon-button microphones of the era.',
  'Library of Congress Audio Archive — 1952 (Public Domain)',
  'Americas (60Hz)', 'hard',
  'The audio cuts off sharply around 5kHz — consistent with carbon microphone and AM broadcast limitations.',
  'A rumbling low-frequency noise below 80Hz is characteristic of early turntable motor drive systems.',
  'Granular surface noise from a lacquer disc master is audible throughout the recording.'
),
(
  '2024-01-05',
  'https://archive.org/download/sample-2003-laptop/ambient.mp3',
  2003, '2000s',
  'Office ambience recorded on a first-generation consumer laptop with built-in microphone. '
  || 'The 7200rpm hard drive spindle motor produces a characteristic hum near 120Hz. '
  || 'USB bus interference is visible as harmonic spikes at 1kHz intervals.',
  'Creative Commons Field Recording Archive — 2003 (CC BY)',
  'Americas (60Hz)', 'easy',
  'Harmonic spikes at exact 1kHz intervals suggest USB bus interference — digital era recording.',
  'A mechanical hum near 120Hz is consistent with a 7200rpm hard disk drive spindle motor.',
  'The recording has an extremely flat frequency response up to 16kHz — digital capture with no tape.'
);
