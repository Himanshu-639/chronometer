// ─── GET /api/puzzle?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns puzzle WITHOUT the answer year.
// Strictly serves local synthetic era audio files (zero internet/network dependencies).

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { Puzzle } from '@/types/puzzle';

const DEV_PUZZLE: Puzzle = {
  id: 0,
  puzzleDate: new Date().toISOString().slice(0, 10),
  audioUrl: '/audio/dev-sample.wav',
  audioStartOffset: 2,
  region: 'EU/Asia (50Hz)',
  difficulty: 'medium',
  clues: [
    'A strong harmonic series starts at 50Hz — suggesting European or Asian mains electricity.',
    'The noise floor rises sharply above 12kHz, consistent with early magnetic tape formulations.',
    'Subtle flutter sidebands are visible around 3kHz — characteristic of 1960s broadcast tape transport speed instability.',
  ],
  totalPuzzles: 1,
};

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date');
  const idParam = request.nextUrl.searchParams.get('id');
  const isRandom = request.nextUrl.searchParams.get('random') === 'true';

  try {
    const manifestPath = path.join(process.cwd(), 'public', 'puzzles.json');
    if (fs.existsSync(manifestPath)) {
      const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let match = null;

      if (isRandom && list.length > 0) {
        const randIdx = Math.floor(Math.random() * list.length);
        match = list[randIdx];
      } else if (idParam !== null) {
        const reqId = parseInt(idParam, 10);
        match = list.find((p: any) => p.id === reqId) || list[Math.abs(reqId) % list.length];
      } else if (dateParam) {
        match = list.find((p: any) => p.puzzleDate === dateParam);
      }

      if (!match && list.length > 0) {
        match = list[0];
      }

      if (match) {
        const puzzle: Puzzle = {
          id: match.id,
          puzzleDate: match.puzzleDate,
          audioUrl: match.audioUrl,
          audioStartOffset: match.audioStartOffset ?? 0,
          region: match.region,
          difficulty: match.difficulty,
          clues: match.clues,
          totalPuzzles: list.length,
        };
        return NextResponse.json(puzzle);
      }
    }
  } catch (err) {
    console.error('Error reading local puzzles manifest:', err);
  }

  return NextResponse.json(DEV_PUZZLE);
}
