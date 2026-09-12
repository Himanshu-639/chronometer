'use client';

// ─── Main Game Screen (Daily Mode) ────────────────────────────────────────────
// Exactly ONE audio puzzle per day.
// Deterministic daily puzzle served across all clients.
// Saves user completion to localStorage — locks in today's score and
// shows live countdown until the next signal.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SpectrogramViewer from '@/components/SpectrogramViewer';
import AudioPlayer from '@/components/AudioPlayer';
import EraSlider from '@/components/EraSlider';
import ClueReveal from '@/components/ClueReveal';
import ResultCard from '@/components/ResultCard';
import Leaderboard from '@/components/Leaderboard';
import { loadAudioBuffer, analyseAudioBuffer } from '@/lib/audio-analysis';
import { getUnlockedClues } from '@/lib/clue-engine';
import { getTodaysPuzzleId, getTodaysDateString, getPuzzleLabel } from '@/lib/puzzle';
import type { Puzzle, PuzzleAnswer, ScoreResult } from '@/types/puzzle';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device-anon';
  const KEY = 'ac_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function GamePage() {
  const router = useRouter();
  const puzzleId = getTodaysPuzzleId();
  const todayDate = getTodaysDateString();

  // ── State ───────────────────────────────────────────────────────────────────
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [staticFrames, setStaticFrames] = useState<Float32Array[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(true);

  const [selectedYear, setSelectedYear] = useState(1975);
  const [guessCount, setGuessCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [usedSpectrogram, setUsedSpectrogram] = useState(false);

  const [answer, setAnswer] = useState<PuzzleAnswer | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const deviceId = useRef<string>('');

  // ── Initialize & Check Daily Completion ─────────────────────────────────────

  useEffect(() => {
    deviceId.current = getOrCreateDeviceId();
    startTimeRef.current = Date.now();

    // 1. Check if user already solved today's puzzle
    const saved = localStorage.getItem(`ac_daily_${todayDate}`) || localStorage.getItem(`ac_result_${puzzleId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answer && parsed.score) {
          setAnswer(parsed.answer);
          setScoreResult(parsed.score);
          if (parsed.selectedYear) setSelectedYear(parsed.selectedYear);
          if (parsed.usedSpectrogram) setUsedSpectrogram(parsed.usedSpectrogram);
          setIsComplete(true);
        }
      } catch (e) {
        console.warn('Corrupted local save:', e);
      }
    }

    // 2. Fetch today's single deterministic puzzle
    fetch(`/api/puzzle?date=${todayDate}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(async (data: Puzzle) => {
        setPuzzle(data);
        // Load audio (slices 5s from offset in-memory)
        try {
          const buf = await loadAudioBuffer(data.audioUrl, data.audioStartOffset ?? 0, 5);
          setAudioBuffer(buf);

          // Precompute static spectrogram
          analyseAudioBuffer(buf).then((analysis) => {
            setStaticFrames(analysis.timeFrames);
          });
        } catch (err) {
          console.error(err);
          setLoadError('Failed to decode today\'s audio. Please refresh to try again.');
        } finally {
          setIsLoadingAudio(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setLoadError('Failed to load today\'s puzzle signal.');
        setIsLoadingAudio(false);
      });
  }, [puzzleId, todayDate]);

  // ── Toggle annotation mode ──────────────────────────────────────────────────

  const handleToggleAnnotations = useCallback(() => {
    setShowAnnotations((v) => {
      if (!v) setUsedSpectrogram(true);
      return !v;
    });
  }, []);

  // ── Submit Guess ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!puzzle || isSubmitting || isComplete) return;
    setIsSubmitting(true);

    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          guessedYear: selectedYear,
          usedSpectrogram,
          timeTaken,
          deviceId: deviceId.current,
        }),
      });

      if (!res.ok) throw new Error(`Score submission failed (${res.status})`);

      const { answer: a, score: s } = await res.json() as { answer: PuzzleAnswer; score: ScoreResult };
      setAnswer(a);
      setScoreResult(s);
      setIsComplete(true);
      setGuessCount((c) => c + 1);

      // Save user completion for today so they cannot re-play today
      const payload = {
        puzzleId: puzzle.id,
        todayDate,
        answer: a,
        score: s,
        selectedYear,
        usedSpectrogram,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem(`ac_daily_${todayDate}`, JSON.stringify(payload));
      localStorage.setItem(`ac_result_${puzzle.id}`, JSON.stringify(payload));
    } catch (err) {
      console.error(err);
      alert('Error submitting your deduction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [puzzle, isSubmitting, isComplete, selectedYear, usedSpectrogram, todayDate]);

  const unlockedClues = puzzle ? getUnlockedClues(puzzle.clues, guessCount) : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 py-6 gap-6"
      style={{ backgroundColor: '#080810', maxWidth: '100vw' }}
    >
      {/* ── Top Bar ── */}
      <header className="w-full max-w-2xl flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-xs transition-colors hover:text-[#39ff14]"
          style={{ color: '#8888aa' }}
        >
          ← Home
        </button>

        <h1
          className="text-sm font-bold tracking-widest"
          style={{ color: '#39ff14', textShadow: '0 0 10px rgba(57,255,20,0.3)' }}
        >
          ACOUSTIC CHRONOMETER
        </h1>

        <span className="text-xs font-mono font-bold" style={{ color: '#8888aa' }}>
          {getPuzzleLabel(puzzleId)}
        </span>
      </header>

      <div className="w-full max-w-2xl space-y-6">

        {/* ── Spectrogram ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#444466' }}>
              Frequency Spectrogram
            </span>
            <button
              onClick={handleToggleAnnotations}
              className="text-xs px-3 py-1 rounded transition-colors"
              style={{
                backgroundColor: showAnnotations ? 'rgba(57,255,20,0.15)' : '#13131f',
                color: showAnnotations ? '#39ff14' : '#8888aa',
                border: `1px solid ${showAnnotations ? 'rgba(57,255,20,0.3)' : '#1e1e30'}`,
              }}
            >
              🔬 Analysis Mode {showAnnotations ? 'ON' : 'OFF'}
            </button>
          </div>
          <SpectrogramViewer
            analyserNode={liveAnalyser}
            staticFrames={staticFrames}
            showAnnotations={showAnnotations}
            height={200}
          />
        </div>

        {/* ── Audio Player ── */}
        <div
          className="flex justify-center p-6 rounded-xl relative"
          style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
        >
          {isLoadingAudio ? (
            <div className="py-6 text-center text-xs animate-pulse" style={{ color: '#39ff14' }}>
              Loading today's acoustic signal…
            </div>
          ) : loadError ? (
            <div className="py-4 text-center">
              <p className="text-xs text-[#ff3860] mb-2">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 rounded text-xs bg-[#1e1e30] text-[#e8e8f0]"
              >
                Reload
              </button>
            </div>
          ) : (
            <AudioPlayer
              audioBuffer={audioBuffer}
              maxReplays={3}
              onAnalyserReady={setLiveAnalyser}
            />
          )}
        </div>

        {/* ── Game Area ── */}
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.div
              key="game-active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Era Slider */}
              <div
                className="p-6 rounded-xl"
                style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
              >
                <p className="text-xs uppercase tracking-widest mb-6 text-center" style={{ color: '#444466' }}>
                  When was this recorded?
                </p>
                <EraSlider
                  value={selectedYear}
                  onChange={setSelectedYear}
                  disabled={isComplete || isLoadingAudio}
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !puzzle || isLoadingAudio}
                className="w-full py-4 rounded-xl text-base font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40"
                style={{
                  backgroundColor: 'rgba(57,255,20,0.12)',
                  color: '#39ff14',
                  border: '2px solid #39ff14',
                  boxShadow: '0 0 20px rgba(57,255,20,0.15)',
                }}
              >
                {isSubmitting ? 'Evaluating Signal…' : `Lock In: ${selectedYear}`}
              </button>

              {/* Clues */}
              <ClueReveal clues={unlockedClues} totalClues={3} />
            </motion.div>
          ) : (
            <motion.div
              key="game-completed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Result Card */}
              {answer && scoreResult && (
                <ResultCard
                  puzzleId={puzzleId}
                  guessedYear={selectedYear}
                  answerYear={answer.answerYear}
                  answerDecade={answer.answerDecade}
                  curatorNote={answer.curatorNote}
                  source={answer.source}
                  score={scoreResult}
                  usedSpectrogram={usedSpectrogram}
                  onHomeClick={() => router.push('/')}
                />
              )}

              {/* Timeline Comparison */}
              {answer && (
                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
                >
                  <p className="text-xs uppercase tracking-widest mb-6 text-center" style={{ color: '#444466' }}>
                    Timeline Comparison
                  </p>
                  <EraSlider
                    value={selectedYear}
                    onChange={() => {}}
                    disabled
                    answerYear={answer.answerYear}
                    revealed
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
