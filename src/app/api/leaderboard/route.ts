// ─── GET /api/leaderboard?puzzleId=N&limit=10 ────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const puzzleId = Number(request.nextUrl.searchParams.get('puzzleId'));
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '10'), 50);

  if (!puzzleId || isNaN(puzzleId)) {
    return NextResponse.json({ error: 'puzzleId required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from('scores')
    .select('id, device_id, final_score, delta_years, time_taken, used_spectrogram, created_at')
    .eq('puzzle_id', puzzleId)
    .order('final_score', { ascending: false })
    .order('time_taken', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: {
      // Short cache — leaderboard updates as players submit
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
