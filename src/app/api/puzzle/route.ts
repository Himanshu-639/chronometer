// ─── GET /api/puzzle?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns today's single daily puzzle WITHOUT the answer year.
// Deterministically serves ONE audio per day using date-based epoch offset.
// All players across the world receive the exact same puzzle on any given date.

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { Puzzle } from '@/types/puzzle';

const EPOCH = new Date('2024-01-01T00:00:00.000Z');

function getDayIdFromDate(dateStr?: string | null): { dayId: number; dateIso: string } {
  const now = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epochDay = new Date(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate());
  const dayId = Math.max(0, Math.floor((today.getTime() - epochDay.getTime()) / 86_400_000));

  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return { dayId, dateIso: `${y}-${m}-${d}` };
}

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date');
  const { dayId, dateIso } = getDayIdFromDate(dateParam);

  try {
    const manifestPath = path.join(process.cwd(), 'public', 'puzzles.json');
    if (fs.existsSync(manifestPath)) {
      const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(list) && list.length > 0) {
        // Deterministic cycle through the 30 synthetic era puzzles
        const sample = list[dayId % list.length];

        const puzzle: Puzzle = {
          id: dayId,
          puzzleDate: dateIso,
          audioUrl: sample.audioUrl,
          audioStartOffset: sample.audioStartOffset ?? 0,
          region: sample.region,
          difficulty: sample.difficulty,
          clues: sample.clues,
        };

        return NextResponse.json(puzzle, {
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    }
  } catch (err) {
    console.error('Error loading daily puzzle:', err);
  }

  // Fallback if manifest unreadable
  const fallback: Puzzle = {
    id: dayId,
    puzzleDate: dateIso,
    audioUrl: '/audio/dev-sample.wav',
    audioStartOffset: 2,
    region: 'EU/Asia (50Hz)',
    difficulty: 'medium',
    clues: [
      'A strong harmonic series starts at 50Hz — suggesting European or Asian mains electricity.',
      'The noise floor rises sharply above 12kHz, consistent with early magnetic tape formulations.',
      'Subtle flutter sidebands are visible around 3kHz — characteristic of 1960s broadcast tape transport speed instability.',
    ],
  };

  return NextResponse.json(fallback);
}
