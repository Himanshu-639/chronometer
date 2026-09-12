'use client';

// ─── Landing Page ─────────────────────────────────────────────────────────────
// Animated oscilloscope intro → CTA to today's puzzle.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTodaysPuzzleId, getPuzzleLabel } from '@/lib/puzzle';

// ── Idle Waveform Animation ───────────────────────────────────────────────────

function IdleWaveform() {
  const bars = [0.3, 0.6, 0.9, 0.5, 1.0, 0.7, 0.4, 0.8, 0.6, 0.3, 0.5, 0.9, 0.7, 0.4, 0.6];
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {bars.map((h, i) => (
        <div
          key={i}
          className="wave-bar w-2 rounded-sm"
          style={{
            height: `${h * 100}%`,
            backgroundColor: '#39ff14',
            boxShadow: '0 0 4px rgba(57,255,20,0.5)',
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const puzzleId = getTodaysPuzzleId();
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`ac_result_${puzzleId}`);
    setAlreadyPlayed(!!saved);
  }, [puzzleId]);

  const handlePlay = () => {
    router.push('/game');
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#080810' }}
    >
      {/* Title */}
      <div className="text-center mb-12">
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-2"
          style={{
            color: '#39ff14',
            textShadow: '0 0 30px rgba(57,255,20,0.4)',
          }}
        >
          ACOUSTIC<br className="sm:hidden" /> CHRONOMETER
        </h1>
        <p className="text-sm uppercase tracking-widest mt-3" style={{ color: '#444466' }}>
          Audio archaeology · Daily puzzle
        </p>
      </div>

      {/* Waveform */}
      <div className="mb-10">
        <IdleWaveform />
      </div>

      {/* Puzzle number */}
      <div
        className="mb-8 px-4 py-2 rounded-lg text-sm"
        style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30', color: '#8888aa' }}
      >
        Today's puzzle: <span style={{ color: '#e8e8f0', fontWeight: 600 }}>{getPuzzleLabel(puzzleId)}</span>
      </div>

      {/* Description */}
      <div className="max-w-md text-center mb-10 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: '#8888aa' }}>
          You'll hear a <strong style={{ color: '#e8e8f0' }}>5-second ambient recording</strong> — no speech,
          no music. Just background resonance, mechanical noise, and electromagnetic signatures.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: '#8888aa' }}>
          Use the interactive spectrogram to identify the{' '}
          <strong style={{ color: '#e8e8f0' }}>decade it was recorded in</strong>.
        </p>
      </div>

      {/* CTA */}
      {alreadyPlayed ? (
        <div className="text-center space-y-4">
          <div
            className="px-6 py-3 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', color: '#39ff14' }}
          >
            ✓ You've already played today's puzzle
          </div>
          <button
            onClick={handlePlay}
            className="text-sm underline"
            style={{ color: '#8888aa' }}
          >
            View results
          </button>
          <p className="text-xs" style={{ color: '#444466' }}>
            Next puzzle drops at midnight
          </p>
        </div>
      ) : (
        <button
          onClick={handlePlay}
          className="relative px-10 py-4 rounded-lg text-base font-bold uppercase tracking-widest transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: 'rgba(57,255,20,0.12)',
            color: '#39ff14',
            border: '2px solid #39ff14',
            boxShadow: '0 0 20px rgba(57,255,20,0.2)',
          }}
        >
          Begin Listening →
        </button>
      )}

      {/* How it works */}
      <div className="mt-16 max-w-lg w-full">
        <p className="text-xs uppercase tracking-widest text-center mb-6" style={{ color: '#444466' }}>
          How It Works
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: '👂', title: 'Listen', desc: 'Play the 5-second clip up to 3 times' },
            { icon: '🔬', title: 'Analyse', desc: 'Use the spectrogram to inspect frequency signatures' },
            { icon: '📅', title: 'Guess', desc: 'Drag the timeline slider to your era estimate' },
          ].map((step) => (
            <div
              key={step.title}
              className="text-center p-4 rounded-lg"
              style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
            >
              <div className="text-2xl mb-2">{step.icon}</div>
              <div className="text-xs font-bold mb-1" style={{ color: '#e8e8f0' }}>
                {step.title}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: '#444466' }}>
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-xs text-center" style={{ color: '#2a2a40' }}>
        All audio sourced from public domain archives.
        <br />
        A new puzzle drops every day at midnight UTC.
      </footer>
    </main>
  );
}
