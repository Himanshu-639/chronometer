'use client';

// ─── Admin — Puzzle Upload ────────────────────────────────────────────────────
// Password-protected page to add new puzzles to the DB.
// Access: /admin

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getClientSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface PuzzleForm {
  puzzleDate: string;
  audioUrl: string;
  answerYear: string;
  answerDecade: string;
  curatorNote: string;
  source: string;
  region: string;
  difficulty: string;
  clue1: string;
  clue2: string;
  clue3: string;
}

const EMPTY_FORM: PuzzleForm = {
  puzzleDate: '',
  audioUrl: '',
  answerYear: '',
  answerDecade: '',
  curatorNote: '',
  source: '',
  region: 'EU/Asia (50Hz)',
  difficulty: 'medium',
  clue1: '',
  clue2: '',
  clue3: '',
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [form, setForm] = useState<PuzzleForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_ADMIN_HINT ?? 'admin')) {
      setAuthed(true);
    } else {
      setMessage({ type: 'error', text: 'Incorrect password' });
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const supabase = getClientSupabase();
    const decade = `${Math.floor(Number(form.answerYear) / 10) * 10}s`;

    const { error } = await supabase.from('puzzles').insert({
      puzzle_date: form.puzzleDate,
      audio_url: form.audioUrl,
      answer_year: Number(form.answerYear),
      answer_decade: form.answerDecade || decade,
      curator_note: form.curatorNote,
      source: form.source,
      region: form.region,
      difficulty: form.difficulty,
      clue_1: form.clue1,
      clue_2: form.clue2,
      clue_3: form.clue3,
    });

    if (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: `✓ Puzzle for ${form.puzzleDate} saved successfully!` });
      setForm(EMPTY_FORM);
    }

    setSubmitting(false);
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#39ff14]';
  const inputStyle = { backgroundColor: '#0f0f1a', border: '1px solid #1e1e30', color: '#e8e8f0' };
  const labelStyle = { color: '#8888aa', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.1em' };

  // ── Login gate ───────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080810' }}>
        <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
          <h1 className="text-xl font-bold text-center" style={{ color: '#39ff14' }}>Admin Access</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
          {message && <p style={{ color: '#ff3860', fontSize: '13px' }}>{message.text}</p>}
          <button
            type="submit"
            className="w-full py-2 rounded-lg text-sm font-bold"
            style={{ backgroundColor: 'rgba(57,255,20,0.1)', color: '#39ff14', border: '1px solid #39ff14' }}
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  // ── Puzzle form ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen p-8" style={{ backgroundColor: '#080810' }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#39ff14' }}>
          Add New Puzzle
        </h1>

        {message && (
          <div
            className="mb-6 p-4 rounded-lg text-sm"
            style={{
              backgroundColor: message.type === 'success' ? 'rgba(57,255,20,0.1)' : 'rgba(255,56,96,0.1)',
              border: `1px solid ${message.type === 'success' ? '#39ff14' : '#ff3860'}`,
              color: message.type === 'success' ? '#39ff14' : '#ff3860',
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date + Audio URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Puzzle Date</label>
              <input type="date" required value={form.puzzleDate}
                onChange={(e) => setForm({ ...form, puzzleDate: e.target.value })}
                className={`${inputClass} mt-1`} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className={`${inputClass} mt-1`} style={inputStyle}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Audio URL (public URL to .mp3)</label>
            <input type="url" required placeholder="https://..." value={form.audioUrl}
              onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
              className={`${inputClass} mt-1`} style={inputStyle} />
            <p style={{ color: '#444466', fontSize: '11px', marginTop: 4 }}>
              Upload to Supabase Storage → Copy public URL. Or use an Internet Archive URL directly.
            </p>
          </div>

          {/* Answer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Answer Year</label>
              <input type="number" required min={1920} max={2024} value={form.answerYear}
                onChange={(e) => setForm({ ...form, answerYear: e.target.value })}
                className={`${inputClass} mt-1`} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Region</label>
              <select value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className={`${inputClass} mt-1`} style={inputStyle}>
                <option value="EU/Asia (50Hz)">EU/Asia (50Hz)</option>
                <option value="Americas (60Hz)">Americas (60Hz)</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Curator Note</label>
            <textarea required rows={3} value={form.curatorNote}
              onChange={(e) => setForm({ ...form, curatorNote: e.target.value })}
              className={`${inputClass} mt-1 resize-none`} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Source Attribution</label>
            <input type="text" required placeholder="Archive name — Year (License)" value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className={`${inputClass} mt-1`} style={inputStyle} />
          </div>

          {/* 3 Clues */}
          {(['clue1', 'clue2', 'clue3'] as const).map((key, i) => (
            <div key={key}>
              <label style={labelStyle}>
                Clue {i + 1}{i === 0 ? ' (always visible)' : ` (unlocks after ${i} wrong guess${i > 1 ? 'es' : ''})`}
              </label>
              <input type="text" required value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className={`${inputClass} mt-1`} style={inputStyle} />
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg font-bold uppercase tracking-widest text-sm disabled:opacity-40"
            style={{ backgroundColor: 'rgba(57,255,20,0.12)', color: '#39ff14', border: '2px solid #39ff14' }}
          >
            {submitting ? 'Saving…' : 'Save Puzzle'}
          </button>
        </form>
      </div>
    </main>
  );
}
