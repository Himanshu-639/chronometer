'use client';

// ─── Era Timeline Slider ──────────────────────────────────────────────────────
// Custom range input spanning 1920–2024 in 5-year increments.
// Shows a phosphor-green glowing thumb with year label.

import { useCallback, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_YEAR = 1920;
const MAX_YEAR = 2024;
const STEP = 1; // 1-year precision, but labels show decade markers

const DECADE_MARKERS = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearToPercent(year: number): number {
  return ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EraSliderProps {
  value: number;
  onChange: (year: number) => void;
  disabled?: boolean;
  /** After reveal: show the correct answer position */
  answerYear?: number | null;
  /** Whether the game is over */
  revealed?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EraSlider({
  value,
  onChange,
  disabled = false,
  answerYear = null,
  revealed = false,
}: EraSliderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  const delta = answerYear !== null ? Math.abs(value - answerYear) : null;
  const fillColor =
    delta === null
      ? '#39ff14'
      : delta === 0
      ? '#39ff14'
      : delta <= 10
      ? '#ffb347'
      : '#ff3860';

  return (
    <div className="w-full select-none">

      {/* Year badge above thumb */}
      <div className="relative mb-2 h-8">
        <div
          className="absolute -translate-x-1/2 transition-all duration-75"
          style={{ left: `${yearToPercent(value)}%` }}
        >
          <div
            className="px-2 py-0.5 rounded text-sm font-bold whitespace-nowrap"
            style={{
              backgroundColor: fillColor,
              color: '#080810',
              boxShadow: `0 0 10px ${fillColor}`,
            }}
          >
            {value}
          </div>
        </div>
      </div>

      {/* Track + thumb */}
      <div className="relative">
        {/* Fill bar from left to thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-l pointer-events-none transition-all"
          style={{
            width: `${yearToPercent(value)}%`,
            backgroundColor: fillColor,
            boxShadow: `0 0 6px ${fillColor}`,
          }}
        />

        <input
          type="range"
          className="era-slider relative z-10"
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={STEP}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          aria-label={`Select year: ${value}`}
          style={
            {
              '--thumb-color': fillColor,
            } as React.CSSProperties
          }
        />

        {/* Answer pin (shown after reveal) */}
        {revealed && answerYear !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ left: `${yearToPercent(answerYear)}%` }}
          >
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: '#39ff14', backgroundColor: '#080810' }}
              />
              <div
                className="mt-1 text-[10px] px-1 rounded whitespace-nowrap"
                style={{ color: '#39ff14', backgroundColor: 'rgba(8,8,16,0.9)' }}
              >
                ✓ {answerYear}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decade markers */}
      <div className="relative mt-3 h-4">
        {DECADE_MARKERS.map((yr) => (
          <div
            key={yr}
            className="absolute -translate-x-1/2"
            style={{ left: `${yearToPercent(yr)}%` }}
          >
            <div className="flex flex-col items-center">
              <div
                className="w-px h-1.5 mb-0.5"
                style={{ backgroundColor: '#2a2a40' }}
              />
              <span
                className="text-[9px]"
                style={{ color: '#444466' }}
              >
                {yr === 2020 ? '2020' : `'${String(yr).slice(2)}`}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
