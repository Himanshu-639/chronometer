// ─── POST /api/score ──────────────────────────────────────────────────────────
// Validates guess server-side, calculates score, caches result for the day,
// and returns answer + score. One submission per user/device per day.

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { calculateScore } from '@/lib/scoring';
import type { PuzzleAnswer, ScoreResult } from '@/types/puzzle';

interface ScoreRequest {
  puzzleId: number;
  guessedYear: number;
  usedSpectrogram: boolean;
  timeTaken: number;
  deviceId: string;
}

interface ScoreResponse {
  answer: PuzzleAnswer;
  score: ScoreResult;
}

const DEV_ANSWER: PuzzleAnswer = {
  answerYear: 1963,
  answerDecade: '1960s',
  curatorNote:
    'Acoustic signal environment with characteristic 50Hz mains hum harmonics and analog tape hiss.',
  source: 'Acoustic Chronometer Historical Archive',
};

// In-memory daily submission cache (deviceId:puzzleId -> ScoreResponse)
const dailyCache = new Map<string, ScoreResponse>();

export async function POST(request: NextRequest) {
  let body: ScoreRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { puzzleId, guessedYear, usedSpectrogram, deviceId } = body;

  if (typeof guessedYear !== 'number' || guessedYear < 1920 || guessedYear > 2024) {
    return NextResponse.json({ error: 'guessedYear out of range' }, { status: 400 });
  }

  const userKey = `${deviceId || 'anon'}:${puzzleId}`;

  // If already submitted for today, return the original score
  if (dailyCache.has(userKey)) {
    return NextResponse.json(dailyCache.get(userKey)!);
  }

  let answerToUse = DEV_ANSWER;

  try {
    const manifestPath = path.join(process.cwd(), 'public', 'puzzles.json');
    if (fs.existsSync(manifestPath)) {
      const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(list) && list.length > 0) {
        // Match today's deterministic sample
        const match = list[puzzleId % list.length];
        if (match) {
          answerToUse = {
            answerYear: match.answerYear,
            answerDecade: match.answerDecade,
            curatorNote: match.curatorNote,
            source: match.source,
          };
        }
      }
    }
  } catch (err) {
    console.error('Error matching score from local manifest:', err);
  }

  const score = calculateScore(guessedYear, answerToUse.answerYear, usedSpectrogram);
  const response: ScoreResponse = { answer: answerToUse, score };

  // Remember the user's score for today
  dailyCache.set(userKey, response);

  return NextResponse.json(response);
}
