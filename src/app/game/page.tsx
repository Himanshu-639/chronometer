'use client';

// ─── Main Game Screen ─────────────────────────────────────────────────────────
// Supports:
//   - Daily Mode (Wordle-style daily puzzle)
//   - Practice / Test Mode with 30 diverse historical era audio samples
//   - Direct sample navigation ([◀ Prev], [Next ▶], [🎲 Random])
//   - Instant reset and multi-audio testing

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SpectrogramViewer from '@/components/SpectrogramViewer';
import AudioPlayer from '@/components/AudioPlayer';
import EraSlider from '@/components/EraSlider';
import ClueReveal from '@/components/ClueReveal';
import ResultCard from '@/components/ResultCard';
import Leaderboard from '@/components/Leaderboard';
import { loadAudioBuffer, analyseAudioBuffer } from '@/lib/audio-analysis';
import { getUnlockedClues } from '@/lib/clue-engine';
import { getTodaysPuzzleId } from '@/lib/puzzle';
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

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── State ───────────────────────────────────────────────────────────────────
  const [currentSampleId, setCurrentSampleId] = useState<number>(() => {
    const p = searchParams.get('sample');
    return p !== null ? parseInt(p, 10) : 0;
  });

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [staticFrames, setStaticFrames] = useState<Float32Array[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

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

  // ── Load Puzzle by ID or Random ─────────────────────────────────────────────

  const loadPuzzle = useCallback(async (sampleId: number | 'random') => {
    setIsLoadingAudio(true);
    setLoadError(null);
    setIsComplete(false);
    setAnswer(null);
    setScoreResult(null);
    setLiveAnalyser(null);
    setSelectedYear(1975);
    setGuessCount(0);
    setUsedSpectrogram(false);
    setShowAnnotations(false);
    startTimeRef.current = Date.now();

    try {
      const url = sampleId === 'random'
        ? `/api/puzzle?random=true`
        : `/api/puzzle?id=${sampleId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Puzzle load failed (${res.status})`);
      const data: Puzzle = await res.json();

      setPuzzle(data);
      setCurrentSampleId(data.id);

      // Load and decode audio with 5s slice offset
      const buf = await loadAudioBuffer(data.audioUrl, data.audioStartOffset ?? 0, 5);
      setAudioBuffer(buf);

      // Offline spectrogram analysis
      analyseAudioBuffer(buf).then((analysis) => {
        setStaticFrames(analysis.timeFrames);
      });
    } catch (err) {
      console.error(err);
      setLoadError('Failed to load audio. Please try another sample.');
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    deviceId.current = getOrCreateDeviceId();
    loadPuzzle(currentSampleId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation Handlers ─────────────────────────────────────────────────────

  const totalPuzzles = puzzle?.totalPuzzles ?? 30;

  const handleNext = () => {
    const nextId = (currentSampleId + 1) % totalPuzzles;
    loadPuzzle(nextId);
  };

  const handlePrev = () => {
    const prevId = (currentSampleId - 1 + totalPuzzles) % totalPuzzles;
    loadPuzzle(prevId);
  };

  const handleRandom = () => {
    loadPuzzle('random');
  };

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
          isPractice: true, // Allows multiple test submissions
        }),
      });

      if (!res.ok) throw new Error(`Score submit failed: ${res.status}`);

      const { answer: a, score: s } = await res.json() as { answer: PuzzleAnswer; score: ScoreResult };
      setAnswer(a);
      setScoreResult(s);
      setIsComplete(true);
      setGuessCount((c) => c + 1);
    } catch (err) {
      console.error(err);
      alert('Something went wrong submitting your score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [puzzle, isSubmitting, isComplete, selectedYear, usedSpectrogram]);

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

        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#8888aa' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          <span>TEST MODE</span>
        </div>
      </header>

      {/* ── Sample Navigation Bar ── */}
      <div
        className="w-full max-w-2xl px-4 py-3 rounded-xl flex items-center justify-between flex-wrap gap-2"
        style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={isLoadingAudio}
            className="px-2.5 py-1 rounded text-xs font-semibold transition-all hover:bg-[#1e1e30] disabled:opacity-30"
            style={{ border: '1px solid #2a2a40', color: '#e8e8f0' }}
            title="Previous sample"
          >
            ◀ Prev
          </button>

          <span className="text-xs font-mono font-bold" style={{ color: '#39ff14' }}>
            Sample #{currentSampleId + 1} of {totalPuzzles}
          </span>

          <button
            onClick={handleNext}
            disabled={isLoadingAudio}
            className="px-2.5 py-1 rounded text-xs font-semibold transition-all hover:bg-[#1e1e30] disabled:opacity-30"
            style={{ border: '1px solid #2a2a40', color: '#e8e8f0' }}
            title="Next sample"
          >
            Next ▶
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRandom}
            disabled={isLoadingAudio}
            className="px-3 py-1 rounded text-xs font-medium transition-all hover:bg-[#1e1e30] disabled:opacity-30"
            style={{ border: '1px solid #2a2a40', color: '#8888aa' }}
          >
            🎲 Random Audio
          </button>

          {isComplete && (
            <button
              onClick={() => loadPuzzle(currentSampleId)}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#39ff14] bg-[rgba(57,255,20,0.1)] border border-[rgba(57,255,20,0.3)]"
            >
              ↻ Retry This
            </button>
          )}
        </div>
      </div>

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
              Loading audio sample #{currentSampleId + 1}…
            </div>
          ) : loadError ? (
            <div className="py-4 text-center">
              <p className="text-xs text-[#ff3860] mb-2">{loadError}</p>
              <button
                onClick={handleNext}
                className="px-3 py-1 rounded text-xs bg-[#1e1e30] text-[#e8e8f0]"
              >
                Skip to Next Sample ▶
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
              key={`game-${currentSampleId}`}
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
                {isSubmitting ? 'Evaluating…' : `Lock In: ${selectedYear}`}
              </button>

              {/* Clues */}
              <ClueReveal clues={unlockedClues} totalClues={3} />
            </motion.div>
          ) : (
            <motion.div
              key={`result-${currentSampleId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Result Card */}
              {answer && scoreResult && (
                <ResultCard
                  puzzleId={currentSampleId}
                  guessedYear={selectedYear}
                  answerYear={answer.answerYear}
                  answerDecade={answer.answerDecade}
                  curatorNote={answer.curatorNote}
                  source={answer.source}
                  score={scoreResult}
                  usedSpectrogram={usedSpectrogram}
                  sampleNumber={currentSampleId + 1}
                  totalSamples={totalPuzzles}
                  onNextSample={handleNext}
                  onRandomSample={handleRandom}
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

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#080810] text-[#39ff14] text-xs font-mono">
          Loading Acoustic Chronometer…
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
