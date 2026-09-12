'use client';

// ─── Spectrogram Viewer ───────────────────────────────────────────────────────
// Canvas-based real-time and static FFT spectrogram.
// Frequency axis: logarithmic (20Hz – 20kHz)
// Color: phosphor green intensity mapped to dB magnitude.
// Supports annotation overlay mode.

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { FrequencyAnnotation } from '@/types/puzzle';
import { FREQUENCY_ANNOTATIONS } from '@/lib/clue-engine';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_DB = -100;
const MAX_DB = -20;
const MIN_HZ = 20;
const MAX_HZ = 20_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map dB value to 0–1 intensity */
function dbToIntensity(db: number): number {
  return Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)));
}

/** Map a frequency to x-position (logarithmic) */
function freqToX(hz: number, width: number): number {
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  const logHz = Math.log10(Math.max(hz, MIN_HZ));
  return ((logHz - logMin) / (logMax - logMin)) * width;
}

/** Map bin index to Hz */
function binToHz(bin: number, fftSize: number, sampleRate: number): number {
  return (bin * sampleRate) / fftSize;
}

// ── Grid Drawing ───────────────────────────────────────────────────────────

function drawFrequencyGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const gridFreqs = [50, 100, 500, 1000, 5000, 10000, 15000];
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.fillStyle = 'rgba(136,136,170,0.7)';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.lineWidth = 1;

  gridFreqs.forEach((hz) => {
    const y = H - freqToX(hz, H);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();

    const label = hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
    ctx.fillText(label, 4, y - 2);
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SpectrogramViewerProps {
  /** Real-time analyser node (during playback) */
  analyserNode?: AnalyserNode | null;
  /** Pre-computed static frames (shown when not playing) */
  staticFrames?: Float32Array[] | null;
  /** Sample rate from AudioBuffer */
  sampleRate?: number;
  /** Whether to show frequency annotation overlays */
  showAnnotations?: boolean;
  /** Duration of the clip in seconds */
  durationSeconds?: number;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpectrogramViewer({
  analyserNode,
  staticFrames,
  sampleRate = 44100,
  showAnnotations = false,
  height = 200,
}: SpectrogramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnRef = useRef<number>(0);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<FrequencyAnnotation | null>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 800, height });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ── Static Spectrogram Render ───────────────────────────────────────────────

  const renderStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !staticFrames || staticFrames.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, W, H);

    const frames = staticFrames;
    const numFrames = frames.length;

    frames.forEach((frame, frameIdx) => {
      const x = (frameIdx / numFrames) * W;
      const colWidth = W / numFrames + 1;

      for (let bin = 0; bin < frame.length; bin++) {
        const hz = binToHz(bin, frame.length * 2, sampleRate);
        if (hz < MIN_HZ || hz > MAX_HZ) continue;

        const y = H - freqToX(hz, H);
        const intensity = dbToIntensity(frame[bin]);

        if (intensity < 0.02) continue;

        const alpha = intensity;
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha})`;
        ctx.fillRect(x, y, colWidth, 2);
      }
    });

    // Draw frequency grid lines
    drawFrequencyGrid(ctx, W, H);
  }, [staticFrames, sampleRate]);

  // ── Real-Time Render Loop ───────────────────────────────────────────────────

  useEffect(() => {
    if (!analyserNode) return;
    columnRef.current = 0;
    let animId: number;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas || !analyserNode) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      if (columnRef.current === 0) {
        ctx.fillStyle = '#080810';
        ctx.fillRect(0, 0, W, H);
      }

      const fftSize = analyserNode.fftSize;
      const data = new Float32Array(analyserNode.frequencyBinCount);
      analyserNode.getFloatFrequencyData(data);

      const x = columnRef.current;
      ctx.fillStyle = '#080810';
      ctx.fillRect(x, 0, 2, H);

      for (let bin = 0; bin < data.length; bin++) {
        const hz = binToHz(bin, fftSize, sampleRate);
        if (hz < MIN_HZ || hz > MAX_HZ) continue;

        const y = H - freqToX(hz, H);
        const intensity = dbToIntensity(data[bin]);
        if (intensity < 0.02) continue;

        ctx.fillStyle = `rgba(57, 255, 20, ${intensity})`;
        ctx.fillRect(x, y, 2, 2);
      }

      columnRef.current = (x + 1) % W;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [analyserNode, sampleRate]);

  useEffect(() => {
    if (!analyserNode && staticFrames) {
      renderStatic();
    }
  }, [staticFrames, analyserNode, renderStatic]);

  // ── Annotation Hover ───────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!showAnnotations) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const H = rect.height;
      const W = rect.width;

      setContainerSize({ width: W, height: H });
      setMouseX(relX);
      setMouseY(relY);

      // Find the closest annotation in pixel distance for accurate selection
      let closest: FrequencyAnnotation | null = null;
      let minDistance = Infinity;

      for (const ann of FREQUENCY_ANNOTATIONS) {
        const annY = H - freqToX(ann.freqHz, H);
        const dist = Math.abs(annY - relY);
        if (dist < 15 && dist < minDistance) {
          minDistance = dist;
          closest = ann;
        }
      }

      setHoveredAnnotation(closest);
    },
    [showAnnotations],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredAnnotation(null);
  }, []);

  // ── Anti-Collision Layout for Overlapping Annotation Labels ────────────────

  const annotationsWithLayout = useMemo(() => {
    // Sort from highest frequency to lowest
    const sorted = [...FREQUENCY_ANNOTATIONS].sort((a, b) => b.freqHz - a.freqHz);

    // Track placed label bounds: { y: number, slot: number }
    const placed: { y: number; slot: number }[] = [];

    return sorted.map((ann) => {
      const y = height - freqToX(ann.freqHz, height);
      const pct = (y / height) * 100;

      // Badges that are vertically close (within 15px) must not occupy the same horizontal slot
      const conflicting = placed.filter((p) => Math.abs(p.y - y) < 15);
      const occupiedSlots = new Set(conflicting.map((c) => c.slot));

      let slot = 0;
      while (occupiedSlots.has(slot)) {
        slot++;
      }

      placed.push({ y, slot });

      // Step overlapping badges inward horizontally to completely prevent overlapping text
      const offsetStep = 115;
      const right = 4 + slot * offsetStep;

      return {
        ...ann,
        y,
        pct,
        right,
      };
    });
  }, [height]);

  const annotationLines = showAnnotations
    ? annotationsWithLayout.map((ann) => {
        const isHovered = hoveredAnnotation?.freqHz === ann.freqHz;
        return (
          <div
            key={ann.freqHz}
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ top: `${ann.pct}%` }}
          >
            {/* Horizontal guideline */}
            <div
              className={`h-px w-full transition-opacity duration-150 ${
                isHovered ? 'opacity-90' : 'opacity-35'
              }`}
              style={{
                backgroundColor: ann.color,
                boxShadow: isHovered ? `0 0 6px ${ann.color}` : undefined,
              }}
            />

            {/* Non-overlapping label badge */}
            <span
              className={`absolute text-[9px] px-1.5 py-0.5 rounded pointer-events-auto cursor-pointer font-mono font-medium transition-all duration-150 ${
                isHovered
                  ? 'brightness-125 scale-105 z-20 shadow-md'
                  : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                right: `${ann.right}px`,
                color: ann.color,
                backgroundColor: isHovered ? '#13131f' : 'rgba(8, 8, 16, 0.85)',
                border: `1px solid ${isHovered ? ann.color : 'rgba(255,255,255,0.1)'}`,
                boxShadow: isHovered ? `0 0 8px ${ann.color}60` : undefined,
              }}
              onMouseEnter={() => setHoveredAnnotation(ann)}
              onMouseLeave={() => setHoveredAnnotation(null)}
            >
              {ann.label}
            </span>
          </div>
        );
      })
    : null;

  // ── Smart Tooltip Positioning ──────────────────────────────────────────────
  // Flips vertically when near the bottom to prevent cutoff, and flips horizontally
  // when near the right edge.
  const tooltipStyle = useMemo(() => {
    if (!hoveredAnnotation) return {};

    const W = containerSize.width || 600;
    const H = containerSize.height || height;

    const isBottomHalf = mouseY > H / 2;
    const isRightHalf = mouseX > W - 300;

    const style: React.CSSProperties = {
      backgroundColor: 'rgba(19, 19, 31, 0.96)',
      borderColor: hoveredAnnotation.color,
      color: '#e8e8f0',
      boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 12px ${hoveredAnnotation.color}33`,
    };

    if (isBottomHalf) {
      style.bottom = `${Math.max(8, H - mouseY + 14)}px`;
    } else {
      style.top = `${Math.max(8, mouseY + 14)}px`;
    }

    if (isRightHalf) {
      style.right = `${Math.max(8, W - mouseX + 14)}px`;
    } else {
      style.left = `${Math.max(8, mouseX + 14)}px`;
    }

    return style;
  }, [hoveredAnnotation, mouseX, mouseY, containerSize, height]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Inner canvas container: rounded corners, border, and CRT scanlines */}
      <div className="relative w-full h-full rounded-lg overflow-hidden border border-[#1e1e30] crt-overlay bg-[#080810]">
        <canvas
          ref={canvasRef}
          className="spectrogram-canvas w-full h-full"
          width={800}
          height={height}
        />

        {/* Frequency annotation guidelines & non-overlapping badges */}
        {annotationLines}

        {/* Live playback indicator */}
        {analyserNode && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
            <span className="text-[10px] font-mono text-[#39ff14] tracking-wider">LIVE</span>
          </div>
        )}

        {/* Empty state */}
        {!analyserNode && !staticFrames && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#444466] text-xs font-mono">Play the clip to populate the spectrogram</p>
          </div>
        )}
      </div>

      {/* Floating Hover Tooltip: outside overflow-hidden, with smart flip & collision-safe placement */}
      {hoveredAnnotation && (
        <div
          className="absolute z-30 max-w-xs p-3 rounded-lg border text-xs pointer-events-none shadow-2xl backdrop-blur-md transition-all duration-75"
          style={tooltipStyle}
        >
          <div className="flex items-center gap-2 font-bold mb-1.5" style={{ color: hoveredAnnotation.color }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoveredAnnotation.color }} />
            <span className="truncate">{hoveredAnnotation.label}</span>
            <span className="text-[10px] font-normal opacity-70 ml-auto font-mono whitespace-nowrap">
              {hoveredAnnotation.freqHz >= 1000 ? `${hoveredAnnotation.freqHz / 1000} kHz` : `${hoveredAnnotation.freqHz} Hz`}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#b0b0cc]">
            {hoveredAnnotation.eraContext}
          </p>
        </div>
      )}
    </div>
  );
}

