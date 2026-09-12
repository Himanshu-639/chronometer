# 🎙️ Acoustic Chronometer

> **Audio Archaeology Daily Deduction Game** — GeoGuessr for sound. Listen to 5 seconds of ambient mechanical and environmental resonance stripped of speech. Use an interactive frequency spectrograph to deduce the decade of recording.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 🧭 The Concept

Every era of recording technology leaves a distinct electromagnetic and mechanical fingerprint:
- **1940s**: 4.5kHz carbon/lacquer disc bandwidth cutoff, acetate stylus crackle, 60Hz North American transformer hum.
- **1950s**: 50Hz European mains hum harmonics, capstan flutter, reel-to-reel magnetic tape hiss.
- **1960s**: Vacuum tube mixing console preamp warmth, 13kHz tape ceiling.
- **1970s**: Dolby B cassette tape hiss breathing, 60Hz building resonance.
- **1980s**: 16-bit PCM quantisation noise floor, flat high frequencies up to 18kHz.
- **1990s**: 217Hz GSM mobile phone TDMA pulse buzz, clean digital noise floor.
- **2000s**: 120Hz mechanical hard drive motor whine (7200 RPM), 1kHz USB polling clock spikes.
- **2010s**: Smartphone MEMS microphone sibilance boost, modern gated noise floor.

Players use an interactive real-time Canvas FFT spectrogram to inspect frequency bins and drag a timeline slider to submit their guess.

---

## 🚀 Key Features

- **Interactive Canvas Spectrogram**: Real-time logarithmic frequency analysis (20Hz–20kHz) with era annotations.
- **Distance-Based Scoring Engine**: GeoGuessr-style tiered scoring giving partial credit based on year delta.
- **30 Bundled Historical Era Audio Samples**: Fully self-contained — zero external network dependencies.
- **Oscilloscope Aesthetic**: Dark-mode phosphor green theme with scanlines and real-time audio reactivity.
- **Wordle-Style Share Generator**: Copy score breakdown and emoji grid to clipboard.
- **Multi-Sample Testing Toolbar**: Instantly step through all 30 era audios with `◀ Prev`, `Next ▶`, and `🎲 Random Audio`.
- **Zero API Keys or Paid Services Required**: Deploys out of the box to Vercel, Netlify, or any Node.js host.

---

## 🛠️ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/acoustic-chronometer.git
cd acoustic-chronometer
npm install
```

### 2. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or `/game` for testing).

### 3. Build for Production

```bash
npm run build
npm run start
```

---

## 🌐 Deploy to Vercel (1-Click)

The project is **100% self-contained** and requires **zero environment variables** to run in production:

1. Push your repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep default build settings (`npm run build`, output directory: `.next`).
4. Click **Deploy**.

---

## 🔐 Environment Variables (Optional)

If you wish to enable Supabase cloud database synchronization or leaderboard storage, copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase Project URL (free tier) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase public anonymous key |
| `SUPABASE_SERVICE_KEY` | No | Server-side role key for score inserts |

*Note: Without these variables, the game seamlessly falls back to the bundled 30 daily synthetic era puzzles.*

---

## 📁 Project Structure

```
acoustic-chronometer/
├── public/
│   ├── audio/puzzles/     # 30 synthesized era audio files (.wav)
│   ├── puzzles.json       # Active manifest with dates, clues, and metadata
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── page.tsx       # Landing page with idle waveform
│   │   ├── game/page.tsx  # Game screen with spectrogram & era slider
│   │   ├── admin/page.tsx # Optional admin puzzle uploader
│   │   └── api/
│   │       ├── puzzle/    # GET puzzle metadata (withholds answer)
│   │       ├── score/     # POST guess validation & scoring
│   │       └── leaderboard/
│   ├── components/
│   │   ├── SpectrogramViewer.tsx # Canvas FFT + annotation overlays
│   │   ├── EraSlider.tsx         # Timeline range slider (1920–2024)
│   │   ├── AudioPlayer.tsx       # Play/pause, replay counter, progress
│   │   ├── ClueReveal.tsx        # Progressive clue disclosure
│   │   └── ResultCard.tsx        # Score reveal & sample switcher
│   ├── lib/
│   │   ├── audio-analysis.ts     # Web Audio API engine
│   │   ├── scoring.ts            # Distance-based scoring logic
│   │   └── puzzle.ts             # Deterministic puzzle selection
│   └── types/
│       └── puzzle.ts             # TypeScript definitions
├── scripts/
│   ├── generate-puzzles.ts       # Standalone era acoustic audio synthesizer
│   └── import-real-audio.ts      # Archival audio importer (Wikimedia)
├── .env.local.example
└── package.json
```

---

## 📜 License

MIT © Acoustic Chronometer Contributors. Audio files in `public/audio/` are dedicated to the Public Domain (CC0).
