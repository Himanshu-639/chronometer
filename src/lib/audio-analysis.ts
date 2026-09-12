// ─── Web Audio API Helpers ────────────────────────────────────────────────────
// All analysis runs fully client-side — no server, no API keys.

import type { SpectrogramConfig } from '@/types/puzzle';

// ── Default FFT config ────────────────────────────────────────────────────────

export const DEFAULT_SPECTROGRAM_CONFIG: SpectrogramConfig = {
  fftSize: 4096,
  smoothingTimeConstant: 0.8,
  minDecibels: -100,
  maxDecibels: -20,
};

// ── Audio Context Singleton ───────────────────────────────────────────────────

let _audioContext: AudioContext | null = null;

/**
 * Returns (or lazily creates) the shared AudioContext.
 * Must be called inside a user gesture handler (click/tap) on iOS Safari.
 */
export function getAudioContext(): AudioContext {
  if (!_audioContext || _audioContext.state === 'closed') {
    _audioContext = new AudioContext();
  }
  // Resume if suspended (iOS autoplay policy)
  if (_audioContext.state === 'suspended') {
    _audioContext.resume();
  }
  return _audioContext;
}

// ── Audio Proxy ───────────────────────────────────────────────────────────────

/**
 * Routes external audio URLs through our /api/audio-proxy to bypass CORS.
 * Local/relative URLs are returned unchanged.
 */
export function proxyAudioUrl(url: string): string {
  if (!url) return url;
  // Already a relative or same-origin URL — no proxy needed
  if (url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))) return url;
  return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
}

// ── Buffer Loading ────────────────────────────────────────────────────────────

/**
 * Fetches an audio URL and decodes it into an AudioBuffer.
 * Automatically routes external URLs through the CORS proxy.
 *
 * @param url             Any public audio URL (Freesound preview, Internet Archive, etc.)
 * @param startOffset     Seconds into the file to start from (default 0)
 * @param durationSecs    How many seconds to extract (default 5). Pass Infinity to load all.
 *
 * The returned AudioBuffer contains ONLY the requested window — no trimming needed on your end.
 */
export async function loadAudioBuffer(
  url: string,
  startOffset = 0,
  durationSecs = 5,
): Promise<AudioBuffer> {
  const ctx = getAudioContext();

  // Route through proxy if external URL
  const fetchUrl = proxyAudioUrl(url);

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status} ${fetchUrl}`);
  const arrayBuffer = await response.arrayBuffer();

  // Decode the full file
  const fullBuffer = await ctx.decodeAudioData(arrayBuffer);

  // If no slicing needed, return as-is
  if (startOffset === 0 && durationSecs === Infinity) return fullBuffer;

  // ── Slice the buffer to [startOffset, startOffset + durationSecs] ──────────
  const sampleRate = fullBuffer.sampleRate;
  const startSample = Math.floor(startOffset * sampleRate);
  const endSample = Math.min(
    Math.floor((startOffset + durationSecs) * sampleRate),
    fullBuffer.length,
  );
  const sliceLength = endSample - startSample;

  const numChannels = fullBuffer.numberOfChannels;
  const sliced = ctx.createBuffer(numChannels, sliceLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = fullBuffer.getChannelData(ch).subarray(startSample, endSample);
    sliced.copyToChannel(src, ch, 0);
  }

  return sliced;
}

// ── Playback ──────────────────────────────────────────────────────────────────

export interface PlaybackHandle {
  stop: () => void;
  analyser: AnalyserNode;
}

/**
 * Plays an AudioBuffer through an AnalyserNode.
 * Returns a handle with the analyser (for real-time FFT reads) and a stop fn.
 *
 * @param buffer  Decoded AudioBuffer
 * @param config  FFT configuration
 * @param onEnded Called when the clip finishes naturally
 */
export function playAudio(
  buffer: AudioBuffer,
  config: SpectrogramConfig = DEFAULT_SPECTROGRAM_CONFIG,
  onEnded?: () => void,
): PlaybackHandle {
  const ctx = getAudioContext();

  const analyser = ctx.createAnalyser();
  analyser.fftSize = config.fftSize;
  analyser.smoothingTimeConstant = config.smoothingTimeConstant;
  analyser.minDecibels = config.minDecibels;
  analyser.maxDecibels = config.maxDecibels;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(ctx.destination);

  source.start(0);
  source.onended = () => onEnded?.();

  return {
    stop: () => {
      try { source.stop(); } catch { /* already stopped */ }
    },
    analyser,
  };
}

// ── FFT Analysis ──────────────────────────────────────────────────────────────

/**
 * Reads the current frequency data from an AnalyserNode.
 * Returns a Float32Array of dB values, length = fftSize / 2.
 */
export function getFrequencyData(analyser: AnalyserNode): Float32Array {
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(data);
  return data;
}

/**
 * Converts a frequency bin index to its Hz value.
 */
export function binToHz(binIndex: number, fftSize: number, sampleRate: number): number {
  return (binIndex * sampleRate) / fftSize;
}

/**
 * Converts a Hz value to the nearest bin index.
 */
export function hzToBin(hz: number, fftSize: number, sampleRate: number): number {
  return Math.round((hz * fftSize) / sampleRate);
}

// ── Era Signature Detection ───────────────────────────────────────────────────

export interface HumDetectionResult {
  dominantHz: 50 | 60 | null;
  confidence: number;           // 0–1
  harmonics: number[];          // detected harmonic peaks in Hz
}

/**
 * Detects whether electrical mains hum (50Hz or 60Hz) is present.
 * Used to generate the "region" clue (EU/Asia vs Americas).
 *
 * Strategy: Compare energy at 50/100/150Hz vs 60/120/180Hz harmonics.
 */
export function detectElectricalHum(
  fftData: Float32Array,
  sampleRate: number,
  fftSize: number,
): HumDetectionResult {
  function sumEnergyAt(fundamentals: number[]): number {
    return fundamentals.reduce((sum, hz) => {
      const bin = hzToBin(hz, fftSize, sampleRate);
      // Sum energy over ±2 bins around the target
      let energy = 0;
      for (let b = Math.max(0, bin - 2); b <= Math.min(fftData.length - 1, bin + 2); b++) {
        energy += Math.pow(10, fftData[b] / 10);
      }
      return sum + energy;
    }, 0);
  }

  const harmonics50 = [50, 100, 150, 200, 250];
  const harmonics60 = [60, 120, 180, 240, 300];

  const energy50 = sumEnergyAt(harmonics50);
  const energy60 = sumEnergyAt(harmonics60);
  const total = energy50 + energy60;

  if (total < 1e-10) {
    return { dominantHz: null, confidence: 0, harmonics: [] };
  }

  const conf50 = energy50 / total;
  const conf60 = energy60 / total;

  if (conf50 > 0.55) {
    return { dominantHz: 50, confidence: conf50, harmonics: harmonics50 };
  }
  if (conf60 > 0.55) {
    return { dominantHz: 60, confidence: conf60, harmonics: harmonics60 };
  }
  return { dominantHz: null, confidence: 0, harmonics: [] };
}

/**
 * Estimates the noise floor in dB above 10kHz.
 * High noise floor (> -60dB) → analog tape / vinyl era.
 * Very low noise floor (< -80dB) → digital recording.
 */
export function detectNoiseFloor(
  fftData: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  const startBin = hzToBin(10_000, fftSize, sampleRate);
  const endBin = hzToBin(Math.min(18_000, sampleRate / 2 - 1), fftSize, sampleRate);
  if (startBin >= endBin) return -100;

  let sum = 0;
  let count = 0;
  for (let b = startBin; b <= Math.min(endBin, fftData.length - 1); b++) {
    sum += fftData[b];
    count++;
  }
  return count > 0 ? sum / count : -100;
}

/**
 * Detects a sharp high-frequency rolloff (bandwidth limit).
 * Older recordings often have hard cutoffs: AM radio ~4kHz, FM ~15kHz, tape ~12–16kHz.
 *
 * @returns The estimated bandwidth cutoff in Hz, or null if no clear cutoff.
 */
export function detectBandwidthCutoff(
  fftData: Float32Array,
  sampleRate: number,
  fftSize: number,
): number | null {
  const FLOOR_DB = -70;
  const nyquist = sampleRate / 2;

  // Walk from high freq down until we find sustained energy
  for (let hz = nyquist - 500; hz > 2000; hz -= 500) {
    const bin = hzToBin(hz, fftSize, sampleRate);
    if (bin >= fftData.length) continue;
    if (fftData[bin] > FLOOR_DB) {
      return hz;
    }
  }
  return null;
}

// ── Static FFT (full file analysis) ──────────────────────────────────────────

/**
 * Performs a full offline FFT analysis over the entire AudioBuffer.
 * Returns averaged frequency spectrum across all frames.
 * Used for the static spectrogram display (not real-time).
 */
export async function analyseAudioBuffer(
  buffer: AudioBuffer,
  config: SpectrogramConfig = DEFAULT_SPECTROGRAM_CONFIG,
): Promise<{
  averageSpectrum: Float32Array;
  timeFrames: Float32Array[];
  sampleRate: number;
}> {
  const offlineCtx = new OfflineAudioContext(
    1,
    buffer.length,
    buffer.sampleRate,
  );

  const analyser = offlineCtx.createAnalyser();
  analyser.fftSize = config.fftSize;
  analyser.smoothingTimeConstant = 0;
  analyser.minDecibels = config.minDecibels;
  analyser.maxDecibels = config.maxDecibels;

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(offlineCtx.destination);
  source.start(0);

  // Collect frames using scriptProcessor workaround for offline context
  const frameSize = config.fftSize / 2;
  const numFrames = Math.floor(buffer.length / (config.fftSize / 2));
  const timeFrames: Float32Array[] = [];
  const accumulator = new Float32Array(frameSize);

  // Use script processor to sample frames at regular intervals
  const processor = offlineCtx.createScriptProcessor(config.fftSize / 2, 1, 1);
  analyser.connect(processor);
  processor.connect(offlineCtx.destination);

  processor.onaudioprocess = () => {
    const frame = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frame);
    timeFrames.push(frame);
    for (let i = 0; i < frameSize; i++) {
      accumulator[i] += frame[i];
    }
  };

  await offlineCtx.startRendering();

  const count = timeFrames.length || 1;
  const averageSpectrum = accumulator.map((v) => v / count);

  return { averageSpectrum, timeFrames, sampleRate: buffer.sampleRate };
}
