import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import PhysicalButton from './PhysicalButton.jsx';
import DeviceMockup from './DeviceMockup.jsx';

const easeMech = [0.175, 0.885, 0.32, 1.275];

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
              Build 04.02 · Live Simulation Engine
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: easeMech }}
            className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-[var(--text)] md:text-6xl"
            style={{ textWrap: 'balance' }}
          >
            Warehouse Control
            <br />
            <span className="text-[var(--accent)]">System</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: easeMech }}
            className="mt-6 max-w-lg text-base leading-relaxed text-[var(--text-muted)] md:text-lg"
          >
            Simulate inbound, storage, picking, and outbound flows on a physical,
            tactile console before a single conveyor turns. Every dock, sorter, and
            AMR modeled down to the routing rule.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: easeMech }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <PhysicalButton variant="primary" size="lg" onClick={() => (window.location.href = 'simulator.html')}>
              <Play className="h-4 w-4" strokeWidth={2.5} />
              Watch Demo
            </PhysicalButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-10 flex items-center gap-6 font-mono-ind text-[11px] uppercase tracking-widest text-[var(--text-muted)]/70"
          >
            <span>No install</span>
            <span className="h-3 w-px bg-[var(--border-dark)]" />
            <span>Runs in-browser</span>
            <span className="h-3 w-px bg-[var(--border-dark)]" />
            <span>1,000-order demo</span>
          </motion.div>
        </div>

        <DeviceMockup />
      </div>
    </section>
  );
}
