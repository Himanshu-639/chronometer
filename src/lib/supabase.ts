// ─── Supabase Client (Free Tier) ─────────────────────────────────────────────
// Uses the Supabase JS SDK — free tier includes 500MB DB + 1GB storage.
// All keys are public-safe (anon key only). Service key is server-side only.

import { createClient } from '@supabase/supabase-js';

// ── Environment Variables ─────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // In dev without env, warn but don't crash — app runs with mock data
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'DB features will be unavailable. See .env.local.example.',
    );
  }
}

// ── Client Singleton ──────────────────────────────────────────────────────────

/** Browser-safe Supabase client (uses anon key, respects Row Level Security). */
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ── Type-Safe Helpers ─────────────────────────────────────────────────────────

export interface DbPuzzle {
  id: number;
  puzzle_date: string;
  audio_url: string;
  region: string;
  difficulty: string;
  clue_1: string;
  clue_2: string;
  clue_3: string;
  // answer fields — only returned server-side after a guess
  answer_year?: number;
  answer_decade?: string;
  curator_note?: string;
  source?: string;
}

export interface DbScore {
  id: string;
  puzzle_id: number;
  device_id: string;
  guessed_year: number;
  final_score: number;
  delta_years: number;
  time_taken: number;
  used_spectrogram: boolean;
  created_at: string;
}

/** Fetch today's puzzle (answer fields excluded by RLS policy). */
export async function fetchTodaysPuzzle(date: string): Promise<DbPuzzle | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, puzzle_date, audio_url, region, difficulty, clue_1, clue_2, clue_3')
    .eq('puzzle_date', date)
    .single();
  if (error) { console.error('[fetchTodaysPuzzle]', error); return null; }
  return data;
}

/** Fetch leaderboard for a given puzzle ID. */
export async function fetchLeaderboard(puzzleId: number, limit = 10): Promise<DbScore[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .order('final_score', { ascending: false })
    .order('time_taken', { ascending: true })
    .limit(limit);
  if (error) { console.error('[fetchLeaderboard]', error); return []; }
  return data ?? [];
}
