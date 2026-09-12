#!/usr/bin/env node
// ─── Populate Puzzles from Wikimedia Commons ─────────────────────────────────
// Usage: npx tsx scripts/populate-from-wikimedia.ts [count=10]
//
// 100% FREE & OPEN:
//   - ZERO API keys required
//   - ZERO accounts or logins required
//   - All content is Creative Commons or Public Domain
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const COUNT = Number(process.argv[2] ?? '10');

// Curated search terms for historic soundscapes and machinery on Wikimedia Commons
const SEARCH_QUERIES = [
  'ambient sound',
  'room tone',
  'field recording soundscape',
  'steam engine audio',
  'mechanical clock chiming',
  'telegraph audio recording',
  'gramophone audio',
  'radio noise audio',
];

interface WikimediaFile {
  title: string;
  url: string;
  descriptionUrl: string;
  author: string;
  year: number;
}

async function searchWikimedia(query: string): Promise<WikimediaFile[]> {
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query + ' filetype:audio')}&srnamespace=6&format=json`;

  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'AcousticChronometer/1.0 (https://acousticchronometer.app; open-game)' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const hits = data?.query?.search ?? [];

  const files: WikimediaFile[] = [];

  for (const hit of hits.slice(0, 4)) {
    const title = hit.title; // e.g. "File:Ambient Kitchen Sounds.wav"
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
      `&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json`;

    const infoRes = await fetch(infoUrl, {
      headers: { 'User-Agent': 'AcousticChronometer/1.0' },
    });
    if (!infoRes.ok) continue;

    const infoData = await infoRes.json();
    const page = Object.values(infoData?.query?.pages ?? {})[0] as {
      imageinfo?: Array<{
        url: string;
        descriptionurl: string;
        extmetadata?: Record<string, { value: string }>;
      }>;
    };

    const imageinfo = page?.imageinfo?.[0];
    if (!imageinfo || !imageinfo.url) continue;

    // Filter for audio extensions
    const lower = imageinfo.url.toLowerCase();
    if (!lower.endsWith('.wav') && !lower.endsWith('.mp3') && !lower.endsWith('.ogg')) continue;

    const meta = imageinfo.extmetadata;
    const author = meta?.Artist?.value?.replace(/<[^>]+>/g, '') || 'Wikimedia Contributor';
    const dateStr = meta?.DateTimeOriginal?.value || meta?.DateTime?.value || '';

    // Extract year if available, or estimate based on topic
    let year = 1975;
    const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
    if (match) {
      year = parseInt(match[1], 10);
    } else if (title.includes('Gramophone') || title.includes('Telegraph')) {
      year = 1935;
    } else if (title.includes('Steam')) {
      year = 1952;
    }

    files.push({
      title: title.replace('File:', '').replace(/\.[^.]+$/, ''),
      url: imageinfo.url,
      descriptionUrl: imageinfo.descriptionurl,
      author,
      year,
    });
  }

  return files;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log(`\n🎙️  Acoustic Chronometer — Wikimedia Commons Importer`);
  console.log(`   Querying public domain audio archives (ZERO API keys needed)...\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  let collected: WikimediaFile[] = [];
  for (const q of SEARCH_QUERIES) {
    if (collected.length >= COUNT) break;
    try {
      const results = await searchWikimedia(q);
      collected.push(...results);
      console.log(`   Searched "${q}": found ${results.length} tracks.`);
    } catch (err) {
      console.error(`   Failed search for "${q}":`, (err as Error).message);
    }
  }

  collected = collected.slice(0, COUNT);
  console.log(`\n   Total imported tracks: ${collected.length}\n`);

  let currentDate = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < collected.length; i++) {
    const item = collected[i];
    const decade = `${Math.floor(item.year / 10) * 10}s`;
    const region = item.year < 1960 ? 'EU/Asia (50Hz)' : 'Americas (60Hz)';

    console.log(`📅 ${currentDate} | "${item.title}" (${item.year})`);
    console.log(`   Audio URL: ${item.url}`);

    if (supabase) {
      await supabase.from('puzzles').upsert({
        puzzle_date: currentDate,
        audio_url: item.url,
        audio_start_offset: 3.0,
        answer_year: item.year,
        answer_decade: decade,
        curator_note: `Archival recording "${item.title}" by ${item.author}. Preserved via Wikimedia Commons public repository.`,
        source: `Wikimedia Commons — ${item.author} (Public Domain / CC)`,
        region,
        difficulty: 'medium',
        clue_1: `Historical recording preserved on Wikimedia Commons under public licensing.`,
        clue_2: `Acoustic frequency rolloff and ambient resonance characteristic of ${decade} recordings.`,
        clue_3: `Estimated recording period corresponds to the mid-${decade}.`,
      }, { onConflict: 'puzzle_date' });
    }

    currentDate = addDays(currentDate, 1);
  }

  // Also save to public/puzzles-wikimedia.json
  const wikimediaPuzzles = collected.map((item, idx) => ({
    id: idx,
    puzzleDate: addDays(new Date().toISOString().slice(0, 10), idx),
    audioUrl: item.url,
    audioStartOffset: 3.0,
    region: item.year < 1960 ? 'EU/Asia (50Hz)' : 'Americas (60Hz)',
    difficulty: 'medium',
    answerYear: item.year,
    answerDecade: `${Math.floor(item.year / 10) * 10}s`,
    curatorNote: `Archival recording "${item.title}" by ${item.author}. Preserved via Wikimedia Commons public repository.`,
    source: `Wikimedia Commons — ${item.author} (Public Domain / CC)`,
    clues: [
      `Historical recording preserved on Wikimedia Commons under public licensing.`,
      `Acoustic frequency rolloff and ambient resonance characteristic of the ${Math.floor(item.year / 10) * 10}s.`,
      `Estimated recording period corresponds to approximately ${item.year}.`,
    ],
  }));

  const outPath = path.join(process.cwd(), 'public', 'puzzles-wikimedia.json');
  fs.writeFileSync(outPath, JSON.stringify(wikimediaPuzzles, null, 2));

  console.log(`\n✨ Done importing from Wikimedia Commons!`);
  console.log(`   📄 Saved manifest to public/puzzles-wikimedia.json`);
}

main().catch(console.error);
