import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import PhysicalButton from './PhysicalButton.jsx';
import DeviceMockup from './DeviceMockup.jsx';

const easeMech = [0.175, 0.885, 0.32, 1.275];

// The product name IS the acronym, so the headline sets it that way: one word
// per line, left-aligned, with each initial in the accent. The three red
// letters then stack into a vertical W-C-S down the left edge, and the name
// explains itself without a line of body copy underneath doing it in prose.
const NAME = [
  ['W', 'arehouse'],
  ['C', 'ontrol'],
  ['S', 'ystem'],
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-6 pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeMech }}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5"
            style={{ boxShadow: 'var(--shadow-recessed)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ boxShadow: 'var(--shadow-glow-ok)' }} />
            <span className="font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              Live Simulation Engine
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: easeMech }}
            className="mt-7 text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.03em] text-[var(--text)] md:text-[4.5rem]"
          >
            {NAME.map(([initial, rest]) => (
              <span key={initial} className="block">
                <span className="text-[var(--accent)]">{initial}</span>
                {rest}
              </span>
            ))}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeMech }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <PhysicalButton variant="primary" size="lg" onClick={() => (window.location.href = 'simulator.html')}>
              <Play className="h-4 w-4" strokeWidth={2.5} />
              Watch Demo
            </PhysicalButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text-muted)]/70"
          >
            {/* nowrap per item: narrow screens should break BETWEEN the
                three facts, never inside "in-browser" */}
            <span className="whitespace-nowrap">No install</span>
            <span className="h-3 w-px bg-[var(--border-dark)]" />
            <span className="whitespace-nowrap">Runs in-browser</span>
            <span className="h-3 w-px bg-[var(--border-dark)]" />
            <span className="whitespace-nowrap">1,000-order demo</span>
          </motion.div>
        </div>

        <DeviceMockup />
      </div>
    </section>
  );
}
