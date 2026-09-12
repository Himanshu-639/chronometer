'use client';

// ─── Progressive Clue Reveal ──────────────────────────────────────────────────
// Animates in one clue at a time as the player makes wrong guesses.

import { motion, AnimatePresence } from 'framer-motion';

interface ClueRevealProps {
  clues: string[];        // All clues unlocked so far (from getUnlockedClues)
  totalClues?: number;    // Max clues (for showing locked placeholders)
}

export default function ClueReveal({ clues, totalClues = 3 }: ClueRevealProps) {
  const locked = totalClues - clues.length;

  return (
    <div className="w-full space-y-2">
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#444466' }}>
        Signal Analysis Clues
      </p>

      <AnimatePresence initial={false}>
        {clues.map((clue, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ backgroundColor: '#0f0f1a', border: '1px solid #1e1e30' }}
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
              style={{ backgroundColor: 'rgba(57,255,20,0.15)', color: '#39ff14' }}
            >
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed" style={{ color: '#e8e8f0' }}>
              {clue}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Locked placeholders */}
      {Array.from({ length: locked }, (_, i) => (
        <div
          key={`locked-${i}`}
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ backgroundColor: '#080810', border: '1px dashed #1e1e30' }}
        >
          <span
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            style={{ backgroundColor: '#13131f', color: '#444466' }}
          >
            {clues.length + i + 1}
          </span>
          <p className="text-sm" style={{ color: '#2a2a40' }}>
            🔒 Unlocks after next wrong guess
          </p>
        </div>
      ))}
    </div>
  );
}
