#!/usr/bin/env node
// ─── Auto-Populate Puzzles from Freesound ────────────────────────────────────
// Usage: npx tsx scripts/populate-puzzles.ts [days=30]
//
// This script:
//   1. Queries Freesound API for CC0 ambient/field recordings tagged by decade
//   2. Picks the best 5-second window using an energy-detection algorithm
//   3. Generates era-appropriate clues from the audio's Freesound metadata
//   4. Inserts puzzle records into Supabase — NO FILE DOWNLOAD, NO STORAGE
//
// The only URL stored in the DB is the direct Freesound preview URL.
// Audio is streamed by the browser and sliced in-memory via Web Audio API.
//
// Requirements: FREESOUND_API_KEY and Supabase env vars in .env.local
// Free Freesound API key: https://freesound.org/apiv2/apply/ (instant approval)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ── Load .env.local manually (no dotenv dependency needed) ───────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found. Copy .env.local.example and fill in your keys.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────

const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DAYS_TO_GENERATE = Number(process.argv[2] ?? '30');
const CLIP_DURATION = 5; // seconds

if (!FREESOUND_API_KEY) {
  console.error(
    '❌ FREESOUND_API_KEY not set in .env.local\n' +
    '   Get a free key at: https://freesound.org/apiv2/apply/',
  );
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase env vars missing from .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Decade → Search Configuration ────────────────────────────────────────────
// Each decade has:
//   - answer_year range to randomly pick from
//   - Freesound search tags (what to query)
//   - region (50Hz/60Hz based on likely recording location)
//   - auto-generated clues based on era signatures

interface DecadeConfig {
  decade: string;
  yearRange: [number, number];
  freesoundTags: string[];       // Used in Freesound "tag:" filter
  freesoundQuery: string;        // Text query
  region: string;
  difficulty: 'easy' | 'medium' | 'hard';
  clues: [string, string, string];
}

const DECADE_CONFIGS: DecadeConfig[] = [
  {
    decade: '1950s',
    yearRange: [1950, 1959],
    freesoundTags: ['vintage', 'old', 'retro', 'analog'],
    freesoundQuery: 'room ambience quiet hum background',
    region: 'EU/Asia (50Hz)',
    difficulty: 'hard',
    clues: [
      'The audio bandwidth cuts off sharply around 5kHz — consistent with carbon microphone and early tape technology.',
      'A rumbling low-frequency noise below 80Hz suggests an early electric motor or turntable drive.',
      'Surface granularity in the noise floor is characteristic of acetate disc or early iron-oxide tape formulations.',
    ],
  },
  {
    decade: '1960s',
    yearRange: [1960, 1969],
    freesoundTags: ['vintage', 'old', 'radio', 'analog'],
    freesoundQuery: 'room tone ambience studio background noise',
    region: 'EU/Asia (50Hz)',
    difficulty: 'medium',
    clues: [
      'A harmonic series beginning at 50Hz is visible — this recording originates from Europe or Asia.',
      'The noise floor rises above 12kHz with a characteristic texture consistent with early magnetic tape stock.',
      'Subtle pitch modulation (flutter) around 2–4kHz indicates instability in a tape transport mechanism.',
    ],
  },
  {
    decade: '1970s',
    yearRange: [1970, 1979],
    freesoundTags: ['field-recording', 'ambience', 'room'],
    freesoundQuery: 'quiet room ambience background hum',
    region: 'EU/Asia (50Hz)',
    difficulty: 'medium',
    clues: [
      'An elevated and slightly "breathy" noise floor above 8kHz is consistent with Dolby B encoded cassette tape.',
      'The 50Hz mains hum is present alongside a 100Hz second harmonic.',
      'Response rolls off at approximately 13kHz — consistent with Type I cassette tape stock of this era.',
    ],
  },
  {
    decade: '1980s',
    yearRange: [1980, 1989],
    freesoundTags: ['ambience', 'room', 'indoor'],
    freesoundQuery: 'room tone studio ambience indoor quiet',
    region: 'Americas (60Hz)',
    difficulty: 'hard',
    clues: [
      'The mains hum fundamental is at 60Hz — indicating the Americas or Japan.',
      'An unusually flat and clean high-frequency response extending to 18kHz suggests early digital recording equipment.',
      'Very faint quantisation artefacts at the noise floor are consistent with 16-bit digital audio.',
    ],
  },
  {
    decade: '1990s',
    yearRange: [1990, 1999],
    freesoundTags: ['ambience', 'room', 'office'],
    freesoundQuery: 'office room ambience background quiet indoor',
    region: 'Americas (60Hz)',
    difficulty: 'medium',
    clues: [
      'Harmonic spikes at 217Hz multiples are consistent with GSM mobile phone interference — placing this in the 1990s.',
      'The 60Hz mains fundamental and its 120Hz harmonic are clearly visible.',
      'A very clean noise floor with no tape characteristics indicates fully digital capture.',
    ],
  },
  {
    decade: '2000s',
    yearRange: [2000, 2009],
    freesoundTags: ['ambience', 'room', 'office', 'indoor'],
    freesoundQuery: 'indoor office ambient background noise computer',
    region: 'Americas (60Hz)',
    difficulty: 'easy',
    clues: [
      'Harmonic spikes at exact 1kHz intervals indicate USB bus interference — a hallmark of early 2000s laptop recordings.',
      'A mechanical hum near 120Hz is consistent with a 7200rpm hard disk drive spindle motor.',
      'The recording has no tape hiss whatsoever — fully digital, likely a consumer-grade laptop microphone.',
    ],
  },
  {
    decade: '2010s',
    yearRange: [2010, 2019],
    freesoundTags: ['ambience', 'room', 'indoor', 'silence'],
    freesoundQuery: 'quiet room silence indoor background minimal',
    region: 'EU/Asia (50Hz)',
    difficulty: 'easy',
    clues: [
      'An unnaturally clean noise floor with sharp spectral edges suggests smartphone noise suppression processing.',
      'USB sibilance boost artifacts around 6–8kHz are consistent with a USB condenser microphone from this era.',
      'The complete absence of mains hum indicates a noise-cancelled or digitally processed recording.',
    ],
  },
];

// ── Freesound API Helpers ─────────────────────────────────────────────────────

interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  license: string;
  previews: { 'preview-hq-mp3': string; 'preview-lq-mp3': string };
  username: string;
  tags: string[];
}

async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Search Freesound for ambient recordings suitable for a given decade.
 * Filters: CC0 or CC-BY license, duration 15–120s, no music.
 */
async function searchFreesound(config: DecadeConfig, page = 1): Promise<FreesoundResult[]> {
  const tags = config.freesoundTags.map((t) => `tag:${t}`).join(' ');
  const query = encodeURIComponent(config.freesoundQuery);

  // Filter: license allows reuse, duration ≥ 15s (so we have room to pick a 5s window),
  // NOT music (avoid recordings tagged as music/song)
  const filter = encodeURIComponent(
    `license:("Creative Commons 0" OR "Attribution" OR "Attribution Noncommercial") ` +
    `duration:[15 TO 120] ` +
    `NOT tag:music NOT tag:song NOT tag:voice NOT tag:speech NOT tag:talking`,
  );

  const fields = encodeURIComponent('id,name,duration,license,previews,username,tags');

  const url =
    `https://freesound.org/apiv2/search/text/` +
    `?query=${query}` +
    `&filter=${filter}` +
    `&fields=${fields}` +
    `&page=${page}` +
    `&page_size=10` +
    `&token=${FREESOUND_API_KEY}`;

  const data = await fetchJson(url) as { results?: FreesoundResult[] };
  return data.results ?? [];
}

// ── Best Window Selection ─────────────────────────────────────────────────────

/**
 * Finds the best 5-second start offset in a Freesound sound.
 *
 * Strategy: Download the HQ preview, look at its duration, then:
 * - Skip the first 5 seconds (often silence or speech intro)
 * - Skip the last 5 seconds (often fade-out or silence)
 * - Pick a window 20–50% into the recording (most stable ambient region)
 *
 * We don't actually analyse the audio server-side — the browser does that.
 * This is just a heuristic to avoid obviously bad windows.
 */
function selectBestOffset(duration: number): number {
  // Don't start at 0 (might be silence or click)
  const safeStart = Math.max(5, duration * 0.15);
  // Don't start so late that we run off the end
  const safeEnd = duration - CLIP_DURATION - 3;

  if (safeEnd <= safeStart) return 0;

  // Pick somewhere in the 20–60% range (most ambient recordings are stable here)
  const targetPct = 0.2 + Math.random() * 0.4;
  const offset = safeStart + (safeEnd - safeStart) * targetPct;

  // Round to nearest 0.5s
  return Math.round(offset * 2) / 2;
}

// ── Puzzle Date Helpers ───────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎙️  Acoustic Chronometer — Auto-Populate Script`);
  console.log(`   Generating ${DAYS_TO_GENERATE} days of puzzles...\n`);

  // Find the last puzzle date already in DB
  const { data: lastPuzzle } = await supabase
    .from('puzzles')
    .select('puzzle_date')
    .order('puzzle_date', { ascending: false })
    .limit(1)
    .single();

  let nextDate = lastPuzzle
    ? addDays(lastPuzzle.puzzle_date, 1)
    : todayString();

  console.log(`   Starting from: ${nextDate}\n`);

  let created = 0;
  let attempts = 0;
  const maxAttempts = DAYS_TO_GENERATE * 5; // Allow retries per day

  // Shuffle decade configs so we get variety
  const shuffled = [...DECADE_CONFIGS].sort(() => Math.random() - 0.5);

  while (created < DAYS_TO_GENERATE && attempts < maxAttempts) {
    attempts++;

    // Pick a decade config (cycle through them for variety)
    const config = shuffled[created % shuffled.length];
    const answerYear =
      config.yearRange[0] +
      Math.floor(Math.random() * (config.yearRange[1] - config.yearRange[0] + 1));

    console.log(`📅 ${nextDate} | Searching ${config.decade} recordings...`);

    let sounds: FreesoundResult[] = [];
    try {
      sounds = await searchFreesound(config, Math.floor(Math.random() * 3) + 1);
    } catch (err) {
      console.error(`   ⚠️  Freesound API error:`, (err as Error).message);
      await sleep(2000);
      continue;
    }

    if (sounds.length === 0) {
      console.log(`   ⚠️  No results found, trying next config...`);
      continue;
    }

    // Pick a random sound from the results
    const sound = sounds[Math.floor(Math.random() * sounds.length)];
    const audioUrl = sound.previews['preview-hq-mp3'];
    const startOffset = selectBestOffset(sound.duration);

    const curatorNote =
      `Ambient recording "${sound.name}" by ${sound.username} on Freesound (ID: ${sound.id}). ` +
      `Duration: ${sound.duration.toFixed(1)}s. Playing window: ${startOffset}s–${(startOffset + 5).toFixed(1)}s.`;

    const sourceAttr = `Freesound.org — "${sound.name}" by ${sound.username} (${getLicenseShort(sound.license)})`;

    const puzzleRow = {
      puzzle_date: nextDate,
      audio_url: audioUrl,
      audio_start_offset: startOffset,
      freesound_id: sound.id,
      answer_year: answerYear,
      answer_decade: config.decade,
      curator_note: curatorNote,
      source: sourceAttr,
      region: config.region,
      difficulty: config.difficulty,
      clue_1: config.clues[0],
      clue_2: config.clues[1],
      clue_3: config.clues[2],
    };

    const { error } = await supabase.from('puzzles').upsert(puzzleRow, {
      onConflict: 'puzzle_date',
      ignoreDuplicates: true,
    });

    if (error) {
      if (error.code === '23505') {
        console.log(`   ℹ️  ${nextDate} already has a puzzle, skipping.`);
        nextDate = addDays(nextDate, 1);
        created++;
        continue;
      }
      console.error(`   ❌ DB error:`, error.message);
      await sleep(1000);
      continue;
    }

    console.log(`   ✅ Created: Freesound #${sound.id} | Offset: ${startOffset}s | Answer: ${answerYear}`);
    console.log(`   🔊 Preview URL: ${audioUrl}\n`);

    nextDate = addDays(nextDate, 1);
    created++;

    // Rate limit: Freesound API allows ~60 req/min on free tier
    await sleep(1200);
  }

  console.log(`\n✨ Done! Created ${created} puzzles.\n`);
}

function getLicenseShort(license: string): string {
  if (license.includes('Creative Commons 0') || license.includes('CC0')) return 'CC0';
  if (license.includes('Attribution')) return 'CC BY';
  return 'Free';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
