'use client';

// ─── Daily Leaderboard ────────────────────────────────────────────────────────
// Shows top scores for today's puzzle. Stubbed for single-player, ready for
// multiplayer extension via Supabase Realtime subscriptions.

import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '@/lib/supabase';
import type { DbScore } from '@/lib/supabase';

interface LeaderboardProps {
  puzzleId: number;
  /** Highlight this device's own score */
  myDeviceId?: string;
}

export default function Leaderboard({ puzzleId, myDeviceId }: LeaderboardProps) {
  const [scores, setScores] = useState<DbScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard(puzzleId, 10).then((data) => {
      setScores(data);
      setLoading(false);
    });
  }, [puzzleId]);

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-sm animate-pulse" style={{ color: '#444466' }}>
          Loading leaderboard…
        </div>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: '#444466' }}>
          Be the first to complete today's puzzle!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3
        className="text-xs uppercase tracking-widest mb-4"
        style={{ color: '#444466' }}
      >
        Today's Leaderboard
      </h3>
      <div className="space-y-2">
        {scores.map((entry, i) => {
          const isMe = entry.device_id === myDeviceId;
          const rank = i + 1;
          const medal = medalColors[i] ?? null;

          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{
                backgroundColor: isMe ? 'rgba(57,255,20,0.07)' : '#0f0f1a',
                border: `1px solid ${isMe ? 'rgba(57,255,20,0.25)' : '#1e1e30'}`,
              }}
            >
              {/* Rank */}
              <div
                className="w-6 text-center text-sm font-bold flex-shrink-0"
                style={{ color: medal ?? '#444466' }}
              >
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
              </div>

              {/* Name */}
              <div className="flex-1 text-sm truncate" style={{ color: isMe ? '#39ff14' : '#e8e8f0' }}>
                {isMe ? 'You' : `Player #${entry.device_id.slice(-4).toUpperCase()}`}
              </div>

              {/* Score */}
              <div
                className="text-sm font-bold tabular-nums"
                style={{ color: isMe ? '#39ff14' : '#8888aa' }}
              >
                {entry.final_score.toLocaleString()}
              </div>

              {/* Time */}
              <div className="text-xs tabular-nums" style={{ color: '#444466' }}>
                {entry.time_taken}s
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: '#2a2a40' }}>
        Leaderboard resets daily at midnight UTC
      </p>
    </div>
  );
}
