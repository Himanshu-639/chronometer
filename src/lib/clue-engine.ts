// ─── Progressive Clue Engine ─────────────────────────────────────────────────
// Clues are stored in the DB and unlocked after each failed guess.
// The clue-engine also generates dynamic context annotations for the spectrogram.

import type { FrequencyAnnotation } from '@/types/puzzle';

// ── Clue Unlocking ────────────────────────────────────────────────────────────

/**
 * Returns the clues that should currently be visible.
 *
 * @param allClues      Array of 3 clue strings (from puzzle data)
 * @param guessCount    How many guesses the player has made (0 = none yet)
 * @returns             Subset of clues unlocked so far
 */
export function getUnlockedClues(
  allClues: [string, string, string],
  guessCount: number,
): string[] {
  // Clue 0: always visible (region hint, e.g. 50Hz vs 60Hz)
  // Clue 1: unlocked after 1st wrong guess
  // Clue 2: unlocked after 2nd wrong guess
  if (guessCount === 0) return [allClues[0]];
  if (guessCount === 1) return [allClues[0], allClues[1]];
  return [...allClues];
}

// ── Spectrogram Annotation Definitions ───────────────────────────────────────
// These are static educational annotations shown when Analysis Mode is active.

export const FREQUENCY_ANNOTATIONS: FrequencyAnnotation[] = [
  {
    freqHz: 50,
    label: '50 Hz Mains',
    eraContext:
      'A 50Hz fundamental and its harmonics (100, 150 Hz…) indicate European or Asian electrical mains. ' +
      'Recordings with this hum were made in the UK, Europe, Asia, or Africa.',
    color: '#FF6B35',
  },
  {
    freqHz: 60,
    label: '60 Hz Mains',
    eraContext:
      'A 60Hz fundamental and its harmonics (120, 180 Hz…) indicate North American or Japanese mains. ' +
      'Common in recordings from the USA, Canada, Mexico, and parts of South America.',
    color: '#FF6B35',
  },
  {
    freqHz: 4_000,
    label: 'AM Radio Cutoff',
    eraContext:
      'AM broadcast radio has a bandwidth of roughly 4kHz. If the recording rolls off sharply here, ' +
      'it was likely captured from an AM radio broadcast — common in recordings from the 1920s–1960s.',
    color: '#4ECDC4',
  },
  {
    freqHz: 12_000,
    label: 'Tape Hiss Zone',
    eraContext:
      'Analog magnetic tape recordings exhibit elevated noise above ~8–12kHz. ' +
      'The character of this hiss distinguishes era: reel-to-reel (1950s–70s) vs cassette (1970s–90s). ' +
      'Dolby B/C noise reduction leaves a telltale "breathing" effect.',
    color: '#A8E6CF',
  },
  {
    freqHz: 15_000,
    label: 'FM Broadcast Limit',
    eraContext:
      'FM radio broadcasts are typically limited to 15kHz to prevent stereo subcarrier interference. ' +
      'A clean rolloff at 15kHz suggests an FM radio source from the 1960s onward.',
    color: '#4ECDC4',
  },
  {
    freqHz: 15_500,
    label: 'CRT Horizontal Sync',
    eraContext:
      'Cathode ray tube televisions and monitors emit a 15,625 Hz (PAL) or 15,734 Hz (NTSC) ' +
      'horizontal sync tone. Its presence dates a recording to the pre-LCD era — before ~2005.',
    color: '#FFD93D',
  },
  {
    freqHz: 18_000,
    label: 'Digital Codec Limit',
    eraContext:
      'Early MP3 encoders (pre-2000, 128kbps) often roll off aggressively above 16–18kHz. ' +
      'The shape of this rolloff (shelved vs. hard-cut) reveals the codec generation.',
    color: '#C77DFF',
  },
];

/**
 * Finds the annotation closest to a given frequency (within a tolerance).
 */
export function findAnnotationNear(
  hz: number,
  toleranceHz = 500,
): FrequencyAnnotation | undefined {
  return FREQUENCY_ANNOTATIONS.find(
    (ann) => Math.abs(ann.freqHz - hz) <= toleranceHz,
  );
}

// ── Era Context Blurbs ────────────────────────────────────────────────────────
// Shown on the result screen when the answer is revealed.

export const ERA_CONTEXT: Record<string, string> = {
  '1920s':
    'Carbon microphone era. Recordings exhibit severe high-frequency rolloff (~3kHz) and a distinctive '
    + 'granular noise floor from carbon granule transducers.',
  '1930s':
    'Early condenser and ribbon microphone era. Slightly improved bandwidth (~5kHz). '
    + 'Electrical hum from early AC power systems is common.',
  '1940s':
    'Wartime and post-war recording. Lacquer disc (acetate) direct-to-disc recording. '
    + 'Surface noise and stylus chatter are characteristic.',
  '1950s':
    'Magnetic tape becomes standard. Early reel-to-reel recorders introduce tape hiss and flutter. '
    + '78rpm records give way to 33⅓ LP and 45rpm formats.',
  '1960s':
    'Multitrack tape recording. Studio hum through tube microphone preamps. '
    + 'Early stereo FM broadcasts. Transistor radio introduces tinny 4kHz-limited audio.',
  '1970s':
    'Cassette tape and Dolby B noise reduction. Studio console cross-talk. '
    + 'Reel-to-reel flutter at 0.1–0.3% wow. Disco-era room acoustics with early digital reverb units.',
  '1980s':
    'Compact Disc launches (1982). Early 16-bit 44.1kHz digital artifacts. '
    + 'MIDI clock bleed and early digital reverb "brick wall" at 20kHz. '
    + 'HVAC with belt-drive compressors common in studios.',
  '1990s':
    'MP3 compression artifacts. DAT recorder ticks. '
    + 'Early mobile phone GSM interference (buzz at 217Hz modulation rate). '
    + 'Consumer camcorder CMOS audio with auto-gain pumping.',
  '2000s':
    'Hard drive seek noise (spindle motor hum ~7200rpm → ~120Hz). '
    + 'WiFi 2.4GHz interference harmonics. '
    + 'Laptop fan noise with temperature-varying pitch.',
  '2010s':
    'Smartphone noise-suppression artifacts. USB bus noise at 1kHz intervals. '
    + 'Ultrasonic switching power supply interference. '
    + 'Very low noise floors from digital noise cancellation.',
  '2020s':
    'Neural noise suppression artifacts (characteristic "watery" reverberation tail). '
    + 'Bluetooth codec dropout clicks. '
    + 'Near-field microphone proximity effect from always-on smart speakers.',
};

export function getEraContext(year: number): string {
  const decade = `${Math.floor(year / 10) * 10}s`;
  return ERA_CONTEXT[decade] ?? 'No specific era context available for this period.';
}
